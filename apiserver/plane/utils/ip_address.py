def get_client_ip(request):
    """
    실제 클라이언트 IP 주소를 가져오는 함수
    nginx 프록시 뒤에서 동작할 때는 X-Forwarded-For 또는 X-Real-IP 헤더에서 IP를 가져옴
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For 형식: client, proxy1, proxy2, ...
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR')
    return ip