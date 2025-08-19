# Database MCP Servers

Claude Desktop과 데이터베이스를 연결하는 Model Context Protocol (MCP) 서버 모음입니다.

## 📁 프로젝트 구조

```
MCP/
├── MY_SQL/           # MySQL MCP Server
├── SQL_SERVER/       # Microsoft SQL Server MCP Server
└── README.md         # 이 파일
```

## 🚀 지원 데이터베이스

### MySQL MCP Server
- **위치**: `MY_SQL/`
- **포트**: 3307 (SSH 터널링 시)
- **기능**: MySQL 데이터베이스 읽기 전용 접근

### SQL Server MCP Server  
- **위치**: `SQL_SERVER/`
- **포트**: 1434 (SSH 터널링 시)
- **기능**: Microsoft SQL Server 데이터베이스 읽기 전용 접근

## 🌐 전체 아키텍처

```
Claude Desktop
    ↓
┌─────────────────┬─────────────────┐
│   MySQL MCP     │  SQL Server MCP │
│  (port: 3307)   │  (port: 1434)   │
└─────────────────┴─────────────────┘
    ↓ SSH Tunnel       ↓ SSH Tunnel
┌─────────────────┬─────────────────┐
│ Remote Server A │ Remote Server B │
│   MySQL:3306    │  SQL Server:1433│
└─────────────────┴─────────────────┘
```

## ⚡ 빠른 시작

### 1. 프로젝트 설치
각 MCP 서버 디렉토리에서:
```bash
npm install
npm run build
```

### 2. 환경 설정
각 디렉토리의 `.env` 파일에서 데이터베이스 연결 정보 설정

### 3. Claude Desktop 설정
`claude_desktop_config.json`에 추가:
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["D:/workspace/MCP/MY_SQL/dist/index.js"]
    },
    "mssql": {
      "command": "node",
      "args": ["D:/workspace/MCP/SQL_SERVER/dist/index.js"]
    }
  }
}
```

## 🔧 공통 기능

모든 MCP 서버는 다음 기능을 지원합니다:

- **query**: 안전한 SQL 쿼리 실행 (SELECT만)
- **list_tables**: 테이블 목록 조회
- **describe_table**: 테이블 구조 확인
- **get_table_data**: 데이터 조회 (페이지네이션)
- **search_table**: 조건부 검색

## 🔒 보안 특징

- **읽기 전용**: SELECT, SHOW, DESCRIBE 쿼리만 허용
- **위험 쿼리 차단**: DROP, DELETE, INSERT 등 차단
- **SSH 터널링**: 원격 서버 안전 접근
- **환경 변수**: 민감 정보 분리 관리

## 🌟 고급 기능

### SSH 터널링
- **개인키 인증** 지원
- **비밀번호 인증** 지원  
- **자동 포트 포워딩**
- **연결 오류 처리**

### dotenv 통합
- `.env` 파일 자동 로드
- Claude Desktop 설정 간소화
- 환경별 설정 분리

## 📖 상세 문서

각 MCP 서버의 상세한 사용법은 해당 디렉토리의 README.md를 참조하세요:

- [MySQL MCP 가이드](MY_SQL/README.md)
- [SQL Server MCP 가이드](SQL_SERVER/README.md)

## 🛠️ 개발 정보

- **언어**: TypeScript
- **런타임**: Node.js 18+
- **프로토콜**: Model Context Protocol (MCP)
- **작성자**: qjarl5678

## 📝 라이선스

MIT License 