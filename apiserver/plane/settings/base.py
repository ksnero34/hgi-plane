# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'audit': {
            'format': '%(asctime)s - %(levelname)s - %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'security': {
            'format': '%(asctime)s - %(levelname)s - %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': '/code/plane/logs/audit.log',
            'when': 'midnight',
            'interval': 1,
            'backupCount': 30,  # 30일치 보관
            'formatter': 'audit',
            'encoding': 'utf-8',
        },
        'audit_file_size': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/code/plane/logs/audit.log',
            'maxBytes': 104857600,  # 100MB
            'backupCount': 10,  # 최대 10개 파일 보관
            'formatter': 'audit',
            'encoding': 'utf-8',
        },
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': '/code/plane/logs/security.log',
            'when': 'midnight', 
            'interval': 1,
            'backupCount': 30,  # 30일치 보관
            'formatter': 'security',
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'audit': {
            'handlers': ['audit_file', 'audit_file_size'],
            'level': 'INFO',
            'propagate': True,
        },
        'security': {
            'handlers': ['security_file'],
            'level': 'WARNING',
            'propagate': True,
        },
    },
} 