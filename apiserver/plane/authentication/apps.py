from django.apps import AppConfig


class AuthConfig(AppConfig):
    name = "plane.authentication"
    
    def ready(self):
        import plane.authentication.signals  # 시그널 모듈 임포트