# Python imports
import csv
import io
import json
import zipfile

import boto3
from botocore.client import Config

# Third party imports
from celery import shared_task

# Django imports
from django.conf import settings
from django.utils import timezone
from openpyxl import Workbook

# Module imports
from plane.db.models import ExporterHistory, Issue, FileAsset
from plane.utils.exception_logger import log_exception
from plane.settings.storage import S3Storage


def dateTimeConverter(time):
    if time:
        # 날짜 형식을 ISO 형식(YYYY-MM-DD HH:MM:SS)으로 변경
        return time.strftime("%Y-%m-%d %H:%M:%S")


def dateConverter(time):
    if time:
        # 날짜 형식을 ISO 형식(YYYY-MM-DD)으로 변경
        return time.strftime("%Y-%m-%d")


def create_csv_file(data):
    # UTF-8 with BOM 인코딩을 사용하여 한글이 깨지지 않도록 함
    csv_buffer = io.StringIO()
    # BOM 추가
    csv_buffer.write('\ufeff')
    csv_writer = csv.writer(csv_buffer, delimiter=",", quoting=csv.QUOTE_ALL)

    for row in data:
        csv_writer.writerow(row)

    csv_buffer.seek(0)
    return csv_buffer.getvalue()


def create_json_file(data):
    return json.dumps(data)


def create_xlsx_file(data):
    workbook = Workbook()
    sheet = workbook.active

    for row in data:
        sheet.append(row)

    xlsx_buffer = io.BytesIO()
    workbook.save(xlsx_buffer)
    xlsx_buffer.seek(0)
    return xlsx_buffer.getvalue()


def create_zip_file(files):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        for filename, file_content in files:
            zipf.writestr(filename, file_content)

    zip_buffer.seek(0)
    return zip_buffer


def upload_to_s3(zip_file, workspace_id, token_id, slug):
    file_name = (
        f"export-{slug}-{token_id[:6]}-{str(timezone.now().date())}.zip"
    )
    object_key = f"{workspace_id}/{file_name}"
    expires_in = 7 * 24 * 60 * 60

    # FileAsset 생성
    asset = FileAsset.objects.create(
        attributes={"name": file_name, "type": "application/zip", "size": zip_file.tell()},
        asset=object_key,
        size=zip_file.tell(),
        workspace_id=workspace_id,
        created_by=None,  # 백그라운드 작업이므로 created_by는 None
        entity_type="ISSUE_EXPORT",  # 새로운 entity_type 추가
    )

    if settings.USE_MINIO:
        upload_s3 = boto3.client(
            "s3",
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
        )
        
        # 파일 데이터를 메모리에 읽기
        zip_file.seek(0)
        file_data = zip_file.read()
        
        # put_object를 사용하여 직접 업로드
        upload_s3.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=object_key,
            Body=file_data,
            ContentType="application/zip",
            ACL="public-read"
        )

        # S3Storage를 사용하여 URL 생성
        storage = S3Storage()
        presigned_url = storage.generate_presigned_url(
            object_name=object_key,
            disposition="attachment",
            filename=file_name
        )

    else:
        # If endpoint url is present, use it
        if settings.AWS_S3_ENDPOINT_URL:
            s3 = boto3.client(
                "s3",
                endpoint_url=settings.AWS_S3_ENDPOINT_URL,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
            )
        else:
            s3 = boto3.client(
                "s3",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
            )

        # Upload the file to S3
        s3.upload_fileobj(
            zip_file,
            settings.AWS_STORAGE_BUCKET_NAME,
            object_key,
            ExtraArgs={"ContentType": "application/zip"},
        )

        # Generate presigned url for the uploaded file
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": object_key},
            ExpiresIn=expires_in,
        )

    exporter_instance = ExporterHistory.objects.get(token=token_id)

    # Update the exporter instance with the presigned url
    if presigned_url:
        exporter_instance.url = presigned_url
        exporter_instance.status = "completed"
        exporter_instance.key = object_key
        # FileAsset 업데이트
        asset.is_uploaded = True
        asset.save()
    else:
        exporter_instance.status = "failed"
        # FileAsset 삭제
        asset.delete()

    exporter_instance.save(update_fields=["status", "url", "key"])


def generate_table_row(issue):
    # parent 정보를 가져오기 위해 쿼리 수정
    parent_issue = None
    if issue.get("parent_id"):
        parent_issue = Issue.objects.filter(id=issue["parent_id"]).values(
            "project__identifier", "sequence_id"
        ).first()

    # priority 값에 target_date가 함께 들어가는 문제 해결
    priority = issue.get("priority", "none")
    # 만약 priority에 콤마가 포함되어 있다면 첫 번째 값만 사용
    if isinstance(priority, str) and "," in priority:
        priority = priority.split(",")[0].strip()

    # 담당자 목록을 쉼표로 구분된 문자열로 변환
    if isinstance(issue.get("assignees__email", []), list):
        assignees = ", ".join(issue.get("assignees__email", []))
    else:
        assignees = issue.get("assignees__email", "")
    
    # 라벨 목록을 쉼표로 구분된 문자열로 변환
    if isinstance(issue.get("labels__name", []), list):
        labels = ", ".join(issue.get("labels__name", []))
    else:
        labels = issue.get("labels__name", "")

    return [
        f"""{issue["project__identifier"]}-{issue["sequence_id"]}""",
        issue["project__name"],
        # 부모 이슈 ID 추가
        f"""{parent_issue["project__identifier"]}-{parent_issue["sequence_id"]}""" if parent_issue else "",
        issue["name"],
        issue["description_stripped"],
        issue["state__name"],
        dateConverter(issue["start_date"]),
        dateConverter(issue["target_date"]),
        priority,  # 수정된 priority 값 사용
        # 사용자 이름 대신 이메일 사용
        issue.get("created_by__email", ""),
        # 담당자 이메일 목록을 쉼표로 구분해서 표시
        assignees,
        # 라벨 목록을 쉼표로 구분해서 표시
        labels,
        issue["issue_cycle__cycle__name"],
        dateConverter(issue["issue_cycle__cycle__start_date"]),
        dateConverter(issue["issue_cycle__cycle__end_date"]),
        issue["issue_module__module__name"],
        dateConverter(issue["issue_module__module__start_date"]),
        dateConverter(issue["issue_module__module__target_date"]),
        dateTimeConverter(issue["created_at"]),
        dateTimeConverter(issue["updated_at"]),
        dateTimeConverter(issue["completed_at"]),
        dateTimeConverter(issue["archived_at"]),
    ]


def generate_json_row(issue):
    # parent 정보를 가져오기 위해 쿼리 수정
    parent_issue = None
    if issue.get("parent_id"):
        parent_issue = Issue.objects.filter(id=issue["parent_id"]).values(
            "project__identifier", "sequence_id"
        ).first()

    # priority 값에 target_date가 함께 들어가는 문제 해결
    priority = issue.get("priority", "none")
    # 만약 priority에 콤마가 포함되어 있다면 첫 번째 값만 사용
    if isinstance(priority, str) and "," in priority:
        priority = priority.split(",")[0].strip()

    # 담당자 목록을 쉼표로 구분된 문자열로 변환
    if isinstance(issue.get("assignees__email", []), list):
        assignees = ", ".join(issue.get("assignees__email", []))
    else:
        assignees = issue.get("assignees__email", "")
    
    # 라벨 목록을 쉼표로 구분된 문자열로 변환
    if isinstance(issue.get("labels__name", []), list):
        labels = ", ".join(issue.get("labels__name", []))
    else:
        labels = issue.get("labels__name", "")

    return {
        "ID": f"""{issue["project__identifier"]}-{issue["sequence_id"]}""",
        "Project": issue["project__name"],
        "Parent Issue": f"""{parent_issue["project__identifier"]}-{parent_issue["sequence_id"]}""" if parent_issue else "",
        "Name": issue["name"],
        "Description": issue["description_stripped"],
        "State": issue["state__name"],
        "Start Date": dateConverter(issue["start_date"]),
        "Target Date": dateConverter(issue["target_date"]),
        "Priority": priority,  # 수정된 priority 값 사용
        # 사용자 이름 대신 이메일 사용
        "Created By": issue.get("created_by__email", ""),
        # 담당자 이메일 목록을 쉼표로 구분해서 표시
        "Assignee": assignees,
        # 라벨 목록을 쉼표로 구분해서 표시 
        "Labels": labels,
        "Cycle Name": issue["issue_cycle__cycle__name"],
        "Cycle Start Date": dateConverter(issue["issue_cycle__cycle__start_date"]),
        "Cycle End Date": dateConverter(issue["issue_cycle__cycle__end_date"]),
        "Module Name": issue["issue_module__module__name"],
        "Module Start Date": dateConverter(issue["issue_module__module__start_date"]),
        "Module Target Date": dateConverter(issue["issue_module__module__target_date"]),
        "Created At": dateTimeConverter(issue["created_at"]),
        "Updated At": dateTimeConverter(issue["updated_at"]),
        "Completed At": dateTimeConverter(issue["completed_at"]),
        "Archived At": dateTimeConverter(issue["archived_at"]),
    }


def update_json_row(rows, row):
    matched_index = next(
        (
            index
            for index, existing_row in enumerate(rows)
            if existing_row["ID"] == row["ID"]
        ),
        None,
    )

    if matched_index is not None:
        # 필드 이름으로 정확하게 참조
        existing_assignee = rows[matched_index]["Assignee"]
        existing_labels = rows[matched_index]["Labels"]
        
        assignee = row["Assignee"]
        label = row["Labels"]

        # Assignee 업데이트
        if assignee and assignee.strip():
            if existing_assignee and existing_assignee.strip():
                # 이미 존재하는 담당자가 있고, 새 담당자가 아직 포함되어 있지 않다면 추가
                if assignee not in existing_assignee:
                    rows[matched_index]["Assignee"] += f", {assignee}"
            else:
                # 담당자가 없는 경우 새 담당자로 설정
                rows[matched_index]["Assignee"] = assignee
        
        # Labels 업데이트
        if label and label.strip():
            if existing_labels and existing_labels.strip():
                # 이미 존재하는 라벨이 있고, 새 라벨이 아직 포함되어 있지 않다면 추가
                if label not in existing_labels:
                    rows[matched_index]["Labels"] += f", {label}"
            else:
                # 라벨이 없는 경우 새 라벨로 설정
                rows[matched_index]["Labels"] = label
    else:
        rows.append(row)


def update_table_row(rows, row):
    matched_index = next(
        (index for index, existing_row in enumerate(rows) if existing_row[0] == row[0]),
        None,
    )

    if matched_index is not None:
        # 인덱스를 올바르게 수정 - 10, 11이 Assignee와 Labels임
        existing_assignee = rows[matched_index][10]  # Assignee 인덱스
        existing_labels = rows[matched_index][11]    # Labels 인덱스
        
        assignee = row[10]  # 새 행의 Assignee
        label = row[11]     # 새 행의 Labels

        # Assignee 업데이트
        if assignee and assignee.strip():
            if existing_assignee and existing_assignee.strip():
                # 이미 존재하는 담당자가 있고, 새 담당자가 아직 포함되어 있지 않다면 추가
                if assignee not in existing_assignee:
                    rows[matched_index][10] += f", {assignee}"
            else:
                # 담당자가 없는 경우 새 담당자로 설정
                rows[matched_index][10] = assignee
        
        # Labels 업데이트
        if label and label.strip():
            if existing_labels and existing_labels.strip():
                # 이미 존재하는 라벨이 있고, 새 라벨이 아직 포함되어 있지 않다면 추가
                if label not in existing_labels:
                    rows[matched_index][11] += f", {label}"
            else:
                # 라벨이 없는 경우 새 라벨로 설정
                rows[matched_index][11] = label
    else:
        rows.append(row)


def generate_csv(header, project_id, issues, files):
    """
    Generate CSV export for all the passed issues.
    """
    rows = [header]
    for issue in issues:
        row = generate_table_row(issue)
        update_table_row(rows, row)
    csv_file = create_csv_file(rows)
    files.append((f"{project_id}.csv", csv_file))


def generate_json(header, project_id, issues, files):
    rows = []
    for issue in issues:
        row = generate_json_row(issue)
        update_json_row(rows, row)
    json_file = create_json_file(rows)
    files.append((f"{project_id}.json", json_file))


def generate_xlsx(header, project_id, issues, files):
    rows = [header]
    for issue in issues:
        row = generate_table_row(issue)
        update_table_row(rows, row)
    xlsx_file = create_xlsx_file(rows)
    files.append((f"{project_id}.xlsx", xlsx_file))


@shared_task
def issue_export_task(provider, workspace_id, project_ids, token_id, multiple, slug):
    try:
        exporter_instance = ExporterHistory.objects.get(token=token_id)
        exporter_instance.status = "processing"
        exporter_instance.save(update_fields=["status"])

        # 기본 이슈 정보를 먼저 가져옵니다 (중복 없이)
        base_issues = (
            Issue.objects.filter(
                workspace__id=workspace_id,
                project_id__in=project_ids,
                project__project_projectmember__member=exporter_instance.initiated_by_id,
                project__project_projectmember__is_active=True,
                project__archived_at__isnull=True,
            )
            .select_related("project", "workspace", "state", "parent", "created_by")
            .values(
                "id",
                "project__identifier",
                "project__name",
                "project__id",
                "sequence_id",
                "parent_id",
                "name",
                "description_stripped",
                "priority",
                "start_date",
                "target_date",
                "state__name",
                "created_at",
                "updated_at",
                "completed_at",
                "archived_at",
                "issue_cycle__cycle__name",
                "issue_cycle__cycle__start_date",
                "issue_cycle__cycle__end_date",
                "issue_module__module__name",
                "issue_module__module__start_date",
                "issue_module__module__target_date",
                "created_by__email",
            )
            .order_by("project__identifier", "sequence_id")
        )

        # 이슈 데이터를 저장할 딕셔너리 - 중복 제거를 위해 id를 키로 사용
        issues_data = {}
        
        # 이슈 기본 정보 저장
        for issue in base_issues:
            issue_id = issue["id"]
            issues_data[issue_id] = {
                "id": issue["id"],
                "project__identifier": issue["project__identifier"],
                "project__name": issue["project__name"],
                "project__id": issue["project__id"],
                "sequence_id": issue["sequence_id"],
                "parent_id": issue["parent_id"],
                "name": issue["name"],
                "description_stripped": issue["description_stripped"],
                "priority": issue["priority"],
                "start_date": issue["start_date"],
                "target_date": issue["target_date"],
                "state__name": issue["state__name"],
                "created_at": issue["created_at"],
                "updated_at": issue["updated_at"],
                "completed_at": issue["completed_at"],
                "archived_at": issue["archived_at"],
                "issue_cycle__cycle__name": issue["issue_cycle__cycle__name"],
                "issue_cycle__cycle__start_date": issue["issue_cycle__cycle__start_date"],
                "issue_cycle__cycle__end_date": issue["issue_cycle__cycle__end_date"],
                "issue_module__module__name": issue["issue_module__module__name"],
                "issue_module__module__start_date": issue["issue_module__module__start_date"],
                "issue_module__module__target_date": issue["issue_module__module__target_date"],
                "created_by__email": issue["created_by__email"],
                "assignees__email": [],  # 담당자 이메일 목록
                "labels__name": [],      # 라벨 목록
            }
        
        # 이슈 ID 목록
        issue_ids = list(issues_data.keys())
        
        # 담당자 정보 가져오기
        assignees = Issue.objects.filter(id__in=issue_ids).values("id", "assignees__email").exclude(assignees__email=None)
        for assignee in assignees:
            issue_id = assignee["id"]
            email = assignee["assignees__email"]
            if email and issue_id in issues_data:
                if email not in issues_data[issue_id]["assignees__email"]:
                    issues_data[issue_id]["assignees__email"].append(email)
        
        # 라벨 정보 가져오기
        labels = Issue.objects.filter(id__in=issue_ids).values("id", "labels__name").exclude(labels__name=None)
        for label in labels:
            issue_id = label["id"]
            name = label["labels__name"]
            if name and issue_id in issues_data:
                if name not in issues_data[issue_id]["labels__name"]:
                    issues_data[issue_id]["labels__name"].append(name)
        
        # 최종 이슈 목록 생성
        final_issues = []
        for project_id in project_ids:
            project_issues = [
                issue for issue in issues_data.values() 
                if str(issue["project__id"]) == str(project_id)
            ]
            final_issues.extend(project_issues)
        
        # CSV header 수정
        header = [
            "ID",
            "Project",
            "Parent Issue",  # Parent Issue 컬럼 추가
            "Name",
            "Description",
            "State",
            "Start Date",
            "Target Date",
            "Priority",
            "Created By",
            "Assignee",
            "Labels",
            "Cycle Name",
            "Cycle Start Date",
            "Cycle End Date",
            "Module Name",
            "Module Start Date",
            "Module Target Date",
            "Created At",
            "Updated At",
            "Completed At",
            "Archived At",
        ]

        EXPORTER_MAPPER = {
            "csv": generate_csv,
            "json": generate_json,
            "xlsx": generate_xlsx,
        }

        files = []
        if multiple:
            for project_id in project_ids:
                project_issues = [
                    issue for issue in final_issues 
                    if str(issue["project__id"]) == str(project_id)
                ]
                exporter = EXPORTER_MAPPER.get(provider)
                if exporter is not None:
                    exporter(header, project_id, project_issues, files)
        else:
            exporter = EXPORTER_MAPPER.get(provider)
            if exporter is not None:
                exporter(header, workspace_id, final_issues, files)

        zip_buffer = create_zip_file(files)
        upload_to_s3(zip_buffer, workspace_id, token_id, slug)

    except Exception as e:
        exporter_instance = ExporterHistory.objects.get(token=token_id)
        exporter_instance.status = "failed"
        exporter_instance.reason = str(e)
        exporter_instance.save(update_fields=["status", "reason"])
        log_exception(e)
        return
