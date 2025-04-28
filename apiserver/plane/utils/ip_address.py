def get_client_ip(request):
    # proxy 환경에서 IP를 처리하는 로직이 이미 있으므로 REMOTE_ADDR만 사용
    return request.META.get("REMOTE_ADDR", "")
