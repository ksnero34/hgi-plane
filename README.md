<br /><br />

<p align="center">
<a href="https://plane.so">
  <img src="https://plane-marketing.s3.ap-south-1.amazonaws.com/plane-readme/plane_logo_.webp" alt="Plane Logo" width="70">
</a>
</p>

<h3 align="center"><b>Plane</b></h3>
<p align="center"><b>Open-source project management that unlocks customer value</b></p>

<p align="center">
<a href="https://discord.com/invite/A92xrEGCge">
<img alt="Discord online members" src="https://img.shields.io/discord/1031547764020084846?color=5865F2&label=Discord&style=for-the-badge" />
</a>
<img alt="Commit activity per month" src="https://img.shields.io/github/commit-activity/m/makeplane/plane?style=for-the-badge" />
</p>

<p align="center">
    <a href="https://dub.sh/plane-website-readme"><b>Website</b></a> •
    <a href="https://git.new/releases"><b>Releases</b></a> •
    <a href="https://dub.sh/planepowershq"><b>Twitter</b></a> •
    <a href="https://dub.sh/planedocs"><b>Documentation</b></a>
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

Meet [Plane](https://dub.sh/plane-website-readme), an open-source project management tool to track issues, run ~sprints~ cycles, and manage product roadmaps without the chaos of managing the tool itself. 🧘‍♀️

> Plane is evolving every day. Your suggestions, ideas, and reported bugs help us immensely. Do not hesitate to join in the conversation on [Discord](https://discord.com/invite/A92xrEGCge) or raise a GitHub issue. We read everything and respond to most.

## Customized Plane for HGI

일정 관리 용도로 사용하기 위해 기존 Plane 코드를 커스터마이징 하였습니다.

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
- 중복로그인 방지 기능 추가 (로그인 시 유저의 다른 활성 세션 삭제)
- 워크스페이스 명에 한글 입력 가능하도록 수정
- 이 외 계속 추가중...


## ⚡ Installation

The easiest way to get started with Plane is by creating a [Plane Cloud](https://app.plane.so) account.

If you would like to self-host Plane, please see our [deployment guide](https://docs.plane.so/docker-compose).

| Installation methods | Docs link                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker               | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://docs.plane.so/self-hosting/methods/docker-compose)         |
| Kubernetes           | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://docs.plane.so/kubernetes) |

`Instance admins` can configure instance settings with [God-mode](https://docs.plane.so/instance-admin).

## 🚀 Features

- **Issues**: Quickly create issues and add details using a powerful rich text editor that supports file uploads. Add sub-properties and references to problems for better organization and tracking.

- **Cycles**:
  Keep up your team's momentum with Cycles. Gain insights into your project's progress with burn-down charts and other valuable features.

- **Modules**: Break down your large projects into smaller, more manageable modules. Assign modules between teams to track and plan your project's progress easily.

- **Views**: Create custom filters to display only the issues that matter to you. Save and share your filters in just a few clicks.

- **Pages**: Plane pages, equipped with AI and a rich text editor, let you jot down your thoughts on the fly. Format your text, upload images, hyperlink, or sync your existing ideas into an actionable item or issue.

- **Analytics**: Get insights into all your Plane data in real-time. Visualize issue data to spot trends, remove blockers, and progress your work.

- **Drive** (_coming soon_): The drive helps you share documents, images, videos, or any other files that make sense to you or your team and align on the problem/solution.

## 🛠️ Quick start for contributors

> Development system must have docker engine installed and running.

Setting up local environment is extremely easy and straight forward. Follow the below step and you will be ready to contribute - 

1. Clone the code locally using:
   ```
   git clone https://github.com/makeplane/plane.git
   ```
2. Switch to the code folder:
   ```
   cd plane
   ```
3. Create your feature or fix branch you plan to work on using:
   ```
   git checkout -b <feature-branch-name>
   ```
4. Open terminal and run:
   ```
   ./setup.sh
   ```
5. Open the code on VSCode or similar equivalent IDE.
6. Review the `.env` files available in various folders.
   Visit [Environment Setup](./ENV_SETUP.md) to know about various environment variables used in system.
7. Run the docker command to initiate services:
   ```
   docker compose -f docker-compose-local.yml up -d
   ```

You are ready to make changes to the code. Do not forget to refresh the browser (in case it does not auto-reload).

Thats it!

## ❤️ Community

The Plane community can be found on [GitHub Discussions](https://github.com/orgs/makeplane/discussions), and our [Discord server](https://discord.com/invite/A92xrEGCge). Our [Code of conduct](https://github.com/makeplane/plane/blob/master/CODE_OF_CONDUCT.md) applies to all Plane community chanels.

Ask questions, report bugs, join discussions, voice ideas, make feature requests, or share your projects.

### Repo Activity

![Plane Repo Activity](https://repobeats.axiom.co/api/embed/2523c6ed2f77c082b7908c33e2ab208981d76c39.svg "Repobeats analytics image")

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

## ⛓️ Security

If you believe you have found a security vulnerability in Plane, we encourage you to responsibly disclose this and not open a public issue. We will investigate all legitimate reports.

Email squawk@plane.so to disclose any security vulnerabilities.

## ❤️ Contribute

There are many ways to contribute to Plane, including:

- Submitting [bugs](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%F0%9F%90%9Bbug&projects=&template=--bug-report.yaml&title=%5Bbug%5D%3A+) and [feature requests](https://github.com/makeplane/plane/issues/new?assignees=srinivaspendem%2Cpushya22&labels=%E2%9C%A8feature&projects=&template=--feature-request.yaml&title=%5Bfeature%5D%3A+) for various components.
- Reviewing [the documentation](https://docs.plane.so/) and submitting [pull requests](https://github.com/makeplane/plane), from fixing typos to adding new features.
- Speaking or writing about Plane or any other ecosystem integration and [letting us know](https://discord.com/invite/A92xrEGCge)!
- Upvoting [popular feature requests](https://github.com/makeplane/plane/issues) to show your support.

### We couldn't have done this without you.

<a href="https://github.com/makeplane/plane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=makeplane/plane" />
</a>
