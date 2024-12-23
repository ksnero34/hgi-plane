import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
// constants
import { ORGANIZATION_SIZE, RESTRICTED_URLS } from "@plane/constants";
// types
import { IWorkspace } from "@plane/types";
// components
import { Button, CustomSelect, getButtonStyling, Input, setToast, TOAST_TYPE } from "@plane/ui";
// helpers
import { WEB_BASE_URL } from "@/helpers/common.helper";
// hooks
import { useWorkspace } from "@/hooks/store";
// services
import { WorkspaceService } from "@/services/workspace.service";

const workspaceService = new WorkspaceService();

export const WorkspaceCreateForm = () => {
  // router
  const router = useRouter();
  // states
  const [slugError, setSlugError] = useState(false);
  const [invalidSlug, setInvalidSlug] = useState(false);
  const [defaultValues, setDefaultValues] = useState<Partial<IWorkspace>>({
    name: "",
    slug: "",
    organization_size: "",
  });
  // store hooks
  const { createWorkspace } = useWorkspace();
  // form info
  const {
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
  } = useForm<IWorkspace>({ defaultValues, mode: "onChange" });
  // derived values
  const workspaceBaseURL = encodeURI(WEB_BASE_URL || window.location.origin + "/");

  const handleCreateWorkspace = async (formData: IWorkspace) => {
    await workspaceService
      .workspaceSlugCheck(formData.slug)
      .then(async (res) => {
        if (res.status === true && !RESTRICTED_URLS.includes(formData.slug)) {
          setSlugError(false);
          await createWorkspace(formData)
            .then(async () => {
              setToast({
                type: TOAST_TYPE.SUCCESS,
                title: "Success!",
                message: "Workspace created successfully.",
              });
              router.push(`/workspace`);
            })
            .catch(() => {
              setToast({
                type: TOAST_TYPE.ERROR,
                title: "Error!",
                message: "Workspace could not be created. Please try again.",
              });
            });
        } else setSlugError(true);
      })
      .catch(() => {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "Error!",
          message: "Some error occurred while creating workspace. Please try again.",
        });
      });
  };

  useEffect(
    () => () => {
      // when the component unmounts set the default values to whatever user typed in
      setDefaultValues(getValues());
    },
    [getValues, setDefaultValues]
  );

  return (
    <div className="space-y-8">
      <div className="grid-col grid w-full max-w-4xl grid-cols-1 items-start justify-between gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm text-custom-text-300">Name your workspace</h4>
          <div className="flex flex-col gap-1">
            <Controller
              control={control}
              name="name"
              rules={{
                required: "This is a required field.",
                validate: (value) =>
                  /^[a-zA-Z0-9가-힣\s_-]*$/.test(value) ||
                  `워크스페이스 이름에는 한글, 영문자, 숫자, 공백(" "), 하이픈(-), 언더스코어(_)만 사용할 수 있습니다.`,
                maxLength: {
                  value: 80,
                  message: "이름은 80자를 초과할 수 없습니다.",
                },
              }}
              render={({ field: { value, ref, onChange } }) => (
                <Input
                  id="workspaceName"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    onChange(e.target.value);
                    setValue("name", e.target.value);
                    // 한글을 제외한 영문, 숫자, 특수문자만 허용
                    const englishOnly = e.target.value
                      .replace(/[가-힣]/g, '')
                      .toLowerCase()
                      .trim()
                      .replace(/ /g, "-")
                      .replace(/[^a-z0-9-_]/g, '');
                    setValue("slug", englishOnly, {
                      shouldValidate: true,
                    });
                  }}
                  ref={ref}
                  hasError={Boolean(errors.name)}
                  placeholder="Something familiar and recognizable is always best."
                  className="w-full"
                />
              )}
            />
            <span className="text-xs text-red-500">{errors?.name?.message}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm text-custom-text-300">Set your workspace&apos;s URL</h4>
          <div className="flex gap-0.5 w-full items-center rounded-md border-[0.5px] border-custom-border-200 px-3">
            <span className="whitespace-nowrap text-sm text-custom-text-200">{workspaceBaseURL}</span>
            <Controller
              control={control}
              name="slug"
              rules={{
                required: "The URL is a required field.",
                maxLength: {
                  value: 48,
                  message: "Limit your URL to 48 characters.",
                },
              }}
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  id="workspaceUrl"
                  type="text"
                  value={value.toLocaleLowerCase().trim().replace(/ /g, "-")}
                  onChange={(e) => {
                    if (/^[a-zA-Z0-9_-]+$/.test(e.target.value)) setInvalidSlug(false);
                    else setInvalidSlug(true);
                    onChange(e.target.value.toLowerCase());
                  }}
                  ref={ref}
                  hasError={Boolean(errors.slug)}
                  placeholder="workspace-name"
                  className="block w-full rounded-md border-none bg-transparent !px-0 py-2 text-sm"
                />
              )}
            />
          </div>
          {slugError && <p className="text-sm text-red-500">This URL is taken. Try something else.</p>}
          {invalidSlug && (
            <p className="text-sm text-red-500">{`URLs can contain only ( - ), ( _ ) and alphanumeric characters.`}</p>
          )}
          {errors.slug && <span className="text-xs text-red-500">{errors.slug.message}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm text-custom-text-300">How many people will use this workspace?</h4>
          <div className="w-full">
            <Controller
              name="organization_size"
              control={control}
              rules={{ required: "This is a required field." }}
              render={({ field: { value, onChange } }) => (
                <CustomSelect
                  value={value}
                  onChange={onChange}
                  label={
                    ORGANIZATION_SIZE.find((c) => c === value) ?? (
                      <span className="text-custom-text-400">Select a range</span>
                    )
                  }
                  buttonClassName="!border-[0.5px] !border-custom-border-200 !shadow-none"
                  input
                  optionsClassName="w-full"
                >
                  {ORGANIZATION_SIZE.map((item) => (
                    <CustomSelect.Option key={item} value={item}>
                      {item}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
            {errors.organization_size && (
              <span className="text-sm text-red-500">{errors.organization_size.message}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex max-w-4xl items-center py-1 gap-4">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit(handleCreateWorkspace)}
          disabled={!isValid}
          loading={isSubmitting}
        >
          {isSubmitting ? "Creating workspace" : "Create workspace"}
        </Button>
        <Link className={getButtonStyling("neutral-primary", "sm")} href="/workspace">
          Go back
        </Link>
      </div>
    </div>
  );
};
