# 🔍 SSH 터널링 확인 가이드

## 1️⃣ MCP 서버 직접 실행으로 로그 확인

### MySQL MCP 테스트
```bash
cd MY_SQL
npm start
```

### 성공적인 SSH 터널링 로그 예시:
```
SSH 연결이 성공했습니다.
SSH 터널이 localhost:3307에서 시작되었습니다.
SSH 터널을 통해 MySQL에 연결합니다: localhost:3307
MySQL에 연결되었습니다.
MySQL MCP 서버가 시작되었습니다.
```

### 실패 시 나타나는 오류들:
```
❌ SSH 연결 오류: connect ECONNREFUSED
   → SSH 서버 주소/포트가 잘못됨

❌ SSH 연결 오류: Authentication failed
   → 사용자명/비밀번호가 잘못됨

❌ SSH 포워딩 오류: 
   → 원격 서버에서 MySQL에 접근 불가
```

---

## 2️⃣ 네트워크 포트 상태 확인

### Windows에서 포트 확인:
```powershell
# SSH 터널 포트가 열려있는지 확인
netstat -an | findstr :3307    # MySQL
netstat -an | findstr :1434    # SQL Server
```

### 성공 시 출력 예시:
```
TCP    127.0.0.1:3307         0.0.0.0:0              LISTENING
```

### 포트 연결 테스트:
```powershell
# telnet으로 터널 포트 테스트
telnet localhost 3307
```

---

## 3️⃣ 실제 데이터베이스 연결 테스트

### MySQL 클라이언트로 터널 테스트:
```bash
# SSH 터널을 통한 MySQL 연결
mysql -h localhost -P 3307 -u your_user -p your_database
```

### Node.js 간단 테스트 스크립트:
```javascript
// test-tunnel.js
import mysql from 'mysql2/promise';

const config = {
  host: 'localhost',
  port: 3307,  // SSH 터널 포트
  user: 'your_user',
  password: 'your_password',
  database: 'your_database'
};

try {
  const connection = await mysql.createConnection(config);
  console.log('✅ SSH 터널을 통한 MySQL 연결 성공!');
  await connection.end();
} catch (error) {
  console.error('❌ 연결 실패:', error.message);
}
```

---

## 4️⃣ 단계별 디버깅

### STEP 1: SSH 연결 테스트
```bash
# SSH 서버에 직접 연결 테스트
ssh your_username@your_server.com

# 성공하면 SSH 터널 생성 테스트
ssh -L 3307:localhost:3306 your_username@your_server.com
```

### STEP 2: 원격 서버에서 MySQL 확인
```bash
# SSH로 서버 접속 후
systemctl status mysql          # MySQL 실행 상태
sudo netstat -tlnp | grep :3306 # MySQL 포트 확인
```

### STEP 3: 방화벽 설정 확인
```bash
# 원격 서버에서
sudo ufw status                 # Ubuntu 방화벽
sudo firewall-cmd --list-all    # CentOS 방화벽
```

---

## 5️⃣ 실시간 로그 모니터링

### MCP 서버 로그 확인:
```bash
# 개발 모드로 실행하여 상세 로그 확인
cd MY_SQL
npm run dev
```

### SSH 상세 로그:
```bash
# SSH 클라이언트 디버그 모드
ssh -v -L 3307:localhost:3306 user@server.com
```

---

## 6️⃣ 빠른 체크리스트

### ✅ SSH 터널링 성공 확인:
- [ ] SSH 연결 성공 메시지 출력
- [ ] 터널 포트(3307/1434) LISTENING 상태
- [ ] MySQL/SQL Server 연결 성공 메시지
- [ ] MCP 서버 시작 메시지

### ❌ 실패 시 확인사항:
- [ ] SSH 서버 주소와 포트 정확한지
- [ ] SSH 사용자명과 비밀번호 정확한지
- [ ] 원격 서버에서 MySQL이 실행 중인지
- [ ] 방화벽이 MySQL 포트를 차단하지 않는지
- [ ] MySQL 사용자에게 접근 권한이 있는지

---

## 7️⃣ 문제 해결 팁

### 🔧 일반적인 해결방법:
1. **SSH 키 사용**: 비밀번호 대신 개인키 사용
2. **포트 변경**: 기본 포트가 막혀있을 때
3. **재시작**: 설정 변경 후 MCP 서버 재시작
4. **로그 확인**: 오류 메시지를 자세히 읽기

### 💡 성능 최적화:
- SSH KeepAlive 설정
- 연결 풀 크기 조정
- 타임아웃 설정 증가

---

## 🆘 문제 신고 시 포함할 정보

1. **오류 메시지** (전체 로그)
2. **환경 정보** (OS, Node.js 버전)
3. **네트워크 설정** (방화벽, 포트)
4. **SSH 설정** (인증 방법)
5. **데이터베이스 설정** (버전, 권한) 