# MS SQL Server MCP Server

Microsoft SQL Server용 Model Context Protocol (MCP) 서버입니다.

## 설치

```bash
npm install
npm run build
```

## 환경 설정

`.env` 파일을 생성하고 데이터베이스 연결 정보를 설정하세요:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=your_database
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_CERT=true

# SSH 터널링 설정 (원격 서버 접속 시)
SSH_ENABLED=false
SSH_HOST=your-ssh-server.com
SSH_PORT=22
SSH_USER=your-ssh-username
SSH_PASSWORD=your-ssh-password
SSH_PRIVATE_KEY_PATH=/path/to/your/private/key
SSH_LOCAL_PORT=1434
```

## 사용법

### 개발 모드
```bash
npm run dev
```

### 프로덕션 모드
```bash
npm run build
npm start
```

## 지원 기능

- **query**: SQL 쿼리 실행 (안전한 SELECT 쿼리만)
- **list_tables**: 데이터베이스 테이블 목록 조회
- **describe_table**: 테이블 구조 확인
- **get_table_data**: 테이블 데이터 조회 (페이지네이션 지원)
- **search_table**: 조건부 데이터 검색

## SSH 터널링 지원

원격 서버의 SQL Server에 접근하기 위한 SSH 터널링을 지원합니다:

### 아키텍처 다이어그램
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

### 설정 방법
1. `.env` 파일에서 `SSH_ENABLED=true` 설정
2. SSH 서버 정보 입력 (호스트, 포트, 사용자명)
3. 인증 방법 선택:
   - **비밀번호**: `SSH_PASSWORD` 설정
   - **개인키**: `SSH_PRIVATE_KEY_PATH` 설정

### 작동 방식
```
Claude Desktop → SSH 터널 (localhost:1434) → SSH 서버 → SQL Server
```

### 예시 설정
```env
SSH_ENABLED=true
SSH_HOST=your-server.com
SSH_PORT=22
SSH_USER=your-username
SSH_PASSWORD=your-password
SSH_LOCAL_PORT=1434

DB_SERVER=localhost  # SSH 터널 내부의 SQL Server
DB_PORT=1433
```

## Claude Desktop 설정

Claude Desktop의 `claude_desktop_config.json` 파일에 다음을 추가:

```json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["D:/workspace/MCP/SQL_SERVER/dist/index.js"]
    }
  }
}
```

> **참고**: dotenv를 사용하여 `.env` 파일에서 자동으로 환경변수를 읽어옵니다. 
> 별도로 mcp 연결 시 `env` 설정을 추가할 필요가 없습니다!

## 보안 주의사항

- 이 서버는 읽기 전용 쿼리만 허용합니다
- DROP, DELETE, TRUNCATE, ALTER, CREATE 등의 명령어는 차단됩니다
- 프로덕션 환경에서는 읽기 전용 데이터베이스 사용자를 생성하여 사용하세요

## 문제 해결

### 연결 오류 시
1. SQL Server가 실행 중인지 확인
2. 방화벽 설정 확인
3. 인증 정보가 올바른지 확인
4. TCP/IP 연결이 활성화되어 있는지 확인

### 권한 오류 시
1. 데이터베이스 사용자 권한 확인
2. 스키마 접근 권한 확인 