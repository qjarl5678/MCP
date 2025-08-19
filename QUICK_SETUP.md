# 🚀 빠른 설정 가이드

## 1️⃣ 가장 간단한 설정 (로컬 데이터베이스)

### MySQL이 같은 컴퓨터에 있는 경우

1. **MY_SQL 폴더의 .env 파일 편집**:
```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=test
DB_USER=root
DB_PASSWORD=여기에_비밀번호_입력
DB_SSL=false

SSH_ENABLED=false
```

2. **Claude Desktop 설정** (`%APPDATA%\Claude\claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["D:/workspace/MCP/MY_SQL/dist/index.js"]
    }
  }
}
```

3. **Claude Desktop 재시작**

4. **테스트**: Claude에서 "데이터베이스 테이블 목록을 보여줘" 요청

---

## 2️⃣ 원격 서버 연결 (SSH 터널링)

### 원격 서버에 MySQL이 있는 경우

1. **MY_SQL 폴더의 .env 파일 편집**:
```env
# SSH 터널링 활성화
SSH_ENABLED=true
SSH_HOST=your-server.com
SSH_PORT=22
SSH_USER=your-username
SSH_PASSWORD=ssh-password
SSH_LOCAL_PORT=3307

# 터널 내부의 MySQL 설정
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USER=mysql_user
DB_PASSWORD=mysql_password
DB_SSL=false
```

2. **Claude Desktop 설정은 동일**

---

## 3️⃣ 문제 해결

### ❌ "연결할 수 없습니다" 오류
- MySQL/SQL Server가 실행 중인지 확인
- 포트 번호가 맞는지 확인 (MySQL: 3306, SQL Server: 1433)
- 비밀번호가 맞는지 확인

### ❌ "권한이 없습니다" 오류  
```sql
-- MySQL에서 사용자 권한 부여
GRANT SELECT ON your_database.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### ❌ SSH 연결 오류
- SSH 서버 주소와 포트 확인
- SSH 사용자명과 비밀번호 확인
- 방화벽 설정 확인

---

## 4️⃣ 테스트 명령어

### 직접 실행으로 테스트
```bash
cd MY_SQL
npm start
```

### Claude Desktop에서 테스트
- "테이블 목록을 보여줘"
- "users 테이블 구조를 알려줘"  
- "SELECT * FROM users LIMIT 5 쿼리 실행해줘"

---

## 💡 팁

1. **처음에는 로컬부터**: 같은 컴퓨터의 DB로 먼저 테스트
2. **비밀번호 확인**: 가장 흔한 문제는 잘못된 비밀번호
3. **한 번에 하나씩**: MySQL 먼저 설정하고 나중에 SQL Server
4. **로그 확인**: 오류 발생 시 터미널 메시지 확인

## 🆘 도움이 필요하면

구체적인 오류 메시지나 상황을 알려주시면 더 정확한 해결책을 제시해드립니다! 