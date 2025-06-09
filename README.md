<br /><br />

<p align="center">
<a href="https://plane.so">
  <img src="https://plane-marketing.s3.ap-south-1.amazonaws.com/plane-readme/plane_logo_.webp" alt="Plane Logo" width="70">
</a>
</p>
<h1 align="center"><b>Plane</b></h1>
<p align="center"><b>Open-source project management that unlocks customer value</b></p>

<p align="center">
<a href="https://discord.com/invite/A92xrEGCge">
<img alt="Discord online members" src="https://img.shields.io/discord/1031547764020084846?color=5865F2&label=Discord&style=for-the-badge" />
</a>
<img alt="Commit activity per month" src="https://img.shields.io/github/commit-activity/m/makeplane/plane?style=for-the-badge" />
</p>

<p align="center">
    <a href="https://plane.so/"><b>Website</b></a> •
    <a href="https://github.com/makeplane/plane/releases"><b>Releases</b></a> •
    <a href="https://twitter.com/planepowers"><b>Twitter</b></a> •
    <a href="https://docs.plane.so/"><b>Documentation</b></a>
</p>

<p>
    <a href="https://app.plane.so/#gh-light-mode-only" target="_blank">
      <img
        src="https://plane-marketing.s3.ap-south-1.amazonaws.com/plane-readme/plane_screen.webp"
        alt="Plane Screens"
        width="100%"
      />
    </a>
    <a href="https://app.plane.so/#gh-dark-mode-only" target="_blank">
      <img
        src="https://plane-marketing.s3.ap-south-1.amazonaws.com/plane-readme/plane_screens_dark_mode.webp"
        alt="Plane Screens"
        width="100%"
      />
    </a>
</p>

Meet [Plane](https://plane.so/), an open-source project management tool to track issues, run ~sprints~ cycles, and manage product roadmaps without the chaos of managing the tool itself. 🧘‍♀️

> Plane is evolving every day. Your suggestions, ideas, and reported bugs help us immensely. Do not hesitate to join in the conversation on [Discord](https://discord.com/invite/A92xrEGCge) or raise a GitHub issue. We read everything and respond to most.

## Customized Plane for HGI

프로젝트 일정, 이슈 관리 용도로 사용하기 위해 기존 Plane 코드를 커스터마이징 하였습니다.

#### 추가된 기능

- page에 파일 업로드 기능 추가
- issue 캘린더 뷰에서 시작일과 종료일 사이의 날엔 모두 블록이 나오도록 수정
- issue 캘린더 뷰에서 시작일의 블록을 드래그시 시작일 수정 , 다른 날의 블록 드래그시 종료일 수정 되도록 처리
- OIDC 를 통한 일반 user 로그인 기능 추가 / OIDC 통한 관리자 로그인 기능 추가 (scope 추가 필요, roles 스코프에서 ROLE_CLIENT_ADMIN 있을경우 관리자 로그인 가능)
- 관리자 페이지에 OIDC 설정 추가
- 관리자 페이지에 인스턴스 멤버 목록 조회 기능 추가 및 관리자 설정 기능 추가
- 관리자 페이지에 인스턴스 파일 제어 기능 추가 (허용 확장자 및 허용 용량 수정 가능 , 단 기동시 nginx 프록시 서버의 max_body_size 는 별개의 설정)
- 워크스페이스 및 프로젝트의 권한에 Viewer, Restricted 권한 추가 (viewer의 경우 모든 이슈 조회 가능 및 자신에게 할당된 이슈 수정가능 / restricted의 경우 자신에게 할당된 이슈만 조회/수정 가능)
- page 및 issue 설명란에 개인정보 마스킹기능 추가
- page 의 첨부파일 추가 및 issue의 attachment 추가 시 위 관리자 설정에서 설정한 허용 확장자 및 허용 용량 체크, MIME 타입 체크
- page 본문에 파일 노드 추가 및 업로드 기능 구현(이슈에서도 동일기능 사용 가능)
- 파일노드의 읽기전용 기능 제공 => 작업항목 코멘트나 페이지의 history 에서 읽기전용으로 파일노드 지원
- 중복로그인 방지 기능 추가 (로그인 시 유저의 다른 활성 세션 삭제)
- 워크스페이스 이름에 한글 입력 가능하도록 수정
- 신규 사용자가 기본적으로 들어갈 워크스페이스 설정 가능 + 권한 설정 가능
- apiserver 통해서 버킷통신하도록 수정(권한체크용)
- 작업항목(이슈) 를 프로젝트 페이지에서 파일로 업로드 가능하게 기능 및 버튼, 모달 추가. (워크스페이스 관리화면의 내보내기로 나온 파일 형식 활용)
- os의 이모지 사용하도록 수정(폐쇄망 환경 대응)
- 워크스페이스 초대시 인스턴스에 등록된 사용자 목록 드롭다운으로 추가 가능
- 워크스페이스 초대시 자동수락 기능 추가 (인스턴스에 정보 있는 사용자일경우)
- page에서 pdf로 내보내기 수정 (파일 노드 및 이미지 노드 대응)
- 사용자 신규 생성 시 기본으로 seoul 타임존 및 한국어 설정되도록 수정
- 이름 성 이아니라 성 이름 순으로 나오도록 수정
- oidc 로 사용자 생성 시 비밀번호 입력칸 안나오게 세팅
- oidc id_token에 picture로 이미지 세팅, 검증기능 추가
- 엑셀 등 스프레드 시트의 셀 복사 붙여넣기시 테이블형태로 들어가도록 수정
- 에디터에서 테이블의 셀 드래그로 선택시 merge 및 split 기능 추가
- 추가 한글화(activity, 알림 등)
- 프로젝트를 다른 워크스페이스 이동하는 기능 추가
- page에 디렉토리 구조 구현
- 로그인한 사람의 이슈만 보기 기능 추가
- 커스텀 속성을 동적으로 추가가능하도록 구현 및 필터 기능에도 커스텀 속성 추가
- pagenation 요청 시 작업항목 몇개 요청할지 조정기능 추가
- 일괄변경 기능 추가
- mattermost 알림기능 추가
- 프로젝트 설정에서 작업항목 내보내기 기능 추가가
- 이 외 계속 추가중...


## 🚀 Installation

Getting started with Plane is simple. Choose the setup that works best for you:

- **Plane Cloud**
Sign up for a free account on [Plane Cloud](https://app.plane.so)—it's the fastest way to get up and running without worrying about infrastructure.

- **Self-host Plane**
Prefer full control over your data and infrastructure? Install and run Plane on your own servers. Follow our detailed [deployment guides](https://developers.plane.so/self-hosting/overview) to get started.

| Installation methods | Docs link                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker               | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://developers.plane.so/self-hosting/methods/docker-compose)         |
| Kubernetes           | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://developers.plane.so/self-hosting/methods/kubernetes) |

`Instance admins` can configure instance settings with [God mode](https://developers.plane.so/self-hosting/govern/instance-admin).

## 🌟 Features

- **Issues**
Efficiently create and manage tasks with a robust rich text editor that supports file uploads. Enhance organization and tracking by adding sub-properties and referencing related issues.

- **Cycles**
Maintain your team’s momentum with Cycles. Track progress effortlessly using burn-down charts and other insightful tools.

- **Modules**
Simplify complex projects by dividing them into smaller, manageable modules.

- **Views**
Customize your workflow by creating filters to display only the most relevant issues. Save and share these views with ease.

- **Pages**
Capture and organize ideas using Plane Pages, complete with AI capabilities and a rich text editor. Format text, insert images, add hyperlinks, or convert your notes into actionable items.

- **Analytics**
Access real-time insights across all your Plane data. Visualize trends, remove blockers, and keep your projects moving forward.

- **Drive** (_coming soon_): The drive helps you share documents, images, videos, or any other files that make sense to you or your team and align on the problem/solution.


## 🛠️ Local development

See [CONTRIBUTING](./CONTRIBUTING.md)

## ⚙️ Built with
[![Next JS](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green)](https://www.djangoproject.com/)
[![Node JS](https://img.shields.io/badge/node.js-339933?style=for-the-badge&logo=Node.js&logoColor=white)](https://nodejs.org/en)

## 📸 Screenshots

<p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Issues_rNZjrGgFl.png?updatedAt=1709298765880"
        alt="Plane Views"
        width="100%"
      />
    </a>
  </p>
<p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Cycles_jCDhqmTl9.png?updatedAt=1709298780697"
        width="100%"
      />
    </a>
  </p>
  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Modules_PSCVsbSfI.png?updatedAt=1709298796783"
        alt="Plane Cycles and Modules"
        width="100%"
      />
    </a>
  </p>
  <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Views_uxXsRatS4.png?updatedAt=1709298834522"
        alt="Plane Analytics"
        width="100%"
      />
    </a>
  </p>
   <p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Analytics_0o22gLRtp.png?updatedAt=1709298834389"
        alt="Plane Pages"
        width="100%"
      />
    </a>
  </p>
</p>
<p>
    <a href="https://plane.so" target="_blank">
      <img
        src="https://ik.imagekit.io/w2okwbtu2/Drive_LlfeY4xn3.png?updatedAt=1709298837917"
        alt="Plane Command Menu"
        width="100%"
      />
    </a>
  </p>
</p>

## 📝 Documentation
Explore Plane's [product documentation](https://docs.plane.so/) and [developer documentation](https://developers.plane.so/) to learn about features, setup, and usage.

## ❤️ Community

Join the Plane community on [GitHub Discussions](https://github.com/orgs/makeplane/discussions) and our [Discord server](https://discord.com/invite/A92xrEGCge). We follow a [Code of conduct](https://github.com/makeplane/plane/blob/master/CODE_OF_CONDUCT.md) in all our community channels.

Feel free to ask questions, report bugs, participate in discussions, share ideas, request features, or showcase your projects. We’d love to hear from you!

## 🛡️ Security

If you discover a security vulnerability in Plane, please report it responsibly instead of opening a public issue. We take all legitimate reports seriously and will investigate them promptly. See [Security policy](https://github.com/makeplane/plane/blob/master/SECURITY.md) for more info.

To disclose any security issues, please email us at security@plane.so.

## 🤝 Contributing

There are many ways you can contribute to Plane:

- Report [bugs](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%F0%9F%90%9Bbug&projects=&template=--bug-report.yaml&title=%5Bbug%5D%3A+) or submit [feature requests](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%E2%9C%A8feature&projects=&template=--feature-request.yaml&title=%5Bfeature%5D%3A+).
- Review the [documentation](https://docs.plane.so/) and submit [pull requests](https://github.com/makeplane/docs) to improve it—whether it's fixing typos or adding new content.
- Talk or write about Plane or any other ecosystem integration and [let us know](https://discord.com/invite/A92xrEGCge)!
- Show your support by upvoting [popular feature requests](https://github.com/makeplane/plane/issues).

Please read [CONTRIBUTING.md](https://github.com/makeplane/plane/blob/master/CONTRIBUTING.md) for details on the process for submitting pull requests to us.

### Repo activity

![Plane Repo Activity](https://repobeats.axiom.co/api/embed/2523c6ed2f77c082b7908c33e2ab208981d76c39.svg "Repobeats analytics image")

### We couldn't have done this without you.

<a href="https://github.com/makeplane/plane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=makeplane/plane" />
</a>


## License
This project is licensed under the [GNU Affero General Public License v3.0](https://github.com/makeplane/plane/blob/master/LICENSE.txt).
