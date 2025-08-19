# MySQL MCP Server

MySQL용 Model Context Protocol (MCP) 서버입니다.

## 설치

```bash
npm install
npm run build
```

## 환경 설정

`.env` 파일을 생성하고 데이터베이스 연결 정보를 설정하세요:

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USER=root
DB_PASSWORD=your_password
DB_SSL=false
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
- **list_databases**: 데이터베이스 목록 조회

## Claude Desktop 설정

Claude Desktop의 `claude_desktop_config.json` 파일에 다음을 추가:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["D:/workspace/MCP/MY_SQL/dist/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_DATABASE": "your_database", 
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_SSL": "false"
      }
    }
  }
}
```

## 보안 주의사항

- 이 서버는 읽기 전용 쿼리만 허용합니다
- DROP, DELETE, TRUNCATE, ALTER, CREATE 등의 명령어는 차단됩니다
- 프로덕션 환경에서는 읽기 전용 데이터베이스 사용자를 생성하여 사용하세요

## 문제 해결

### 연결 오류 시
1. MySQL 서버가 실행 중인지 확인
2. 포트 번호가 올바른지 확인 (기본값: 3306)
3. 인증 정보가 올바른지 확인
4. 방화벽 설정 확인

### 권한 오류 시
1. 데이터베이스 사용자 권한 확인
2. 스키마 접근 권한 확인

## MySQL 사용자 생성 예제

읽기 전용 사용자 생성:
```sql
CREATE USER 'mcp_reader'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT ON your_database.* TO 'mcp_reader'@'localhost';
FLUSH PRIVILEGES;
``` 