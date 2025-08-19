import 'dotenv/config';
import mysql from 'mysql2/promise';
import { Client } from 'ssh2';
import * as net from 'net';

// SSH 설정
const sshConfig = {
  enabled: process.env.SSH_ENABLED === 'true',
  host: process.env.SSH_HOST || '',
  port: parseInt(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USER || '',
  password: process.env.SSH_PASSWORD || '',
  localPort: parseInt(process.env.SSH_LOCAL_PORT || '3307'),
};

// MySQL 설정
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? {} : false,
};

console.log('=== SSH 터널링 테스트 시작 ===');
console.log('SSH 설정:', sshConfig);
console.log('DB 설정:', config);
console.log('');

let sshClient = null;
let sshServer = null;

// SSH 터널 생성 함수
async function createSSHTunnel() {
  return new Promise((resolve, reject) => {
    const sshConn = new Client();
    sshClient = sshConn;

    sshConn.on('ready', () => {
      console.log('✅ SSH 연결이 성공했습니다!');
      
      // 로컬 서버 생성
      const server = net.createServer((sock) => {
        console.log('🔗 새로운 터널 연결 요청');
        sshConn.forwardOut(
          sock.remoteAddress || '',
          sock.remotePort || 0,
          config.host,
          config.port,
          (err, stream) => {
            if (err) {
              console.error('❌ SSH 포워딩 오류:', err.message);
              sock.end();
              return;
            }
            console.log('✅ SSH 포워딩 성공');
            sock.pipe(stream).pipe(sock);
          }
        );
      });

      server.listen(sshConfig.localPort, 'localhost', () => {
        console.log(`✅ SSH 터널이 localhost:${sshConfig.localPort}에서 시작되었습니다!`);
        sshServer = server;
        resolve(sshConfig.localPort);
      });

      server.on('error', (err) => {
        console.error('❌ SSH 터널 서버 오류:', err.message);
        reject(err);
      });
    });

    sshConn.on('error', (err) => {
      console.error('❌ SSH 연결 오류:', err.message);
      reject(err);
    });

    // SSH 연결 설정
    const connectOptions = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      password: sshConfig.password,
    };

    console.log('🔄 SSH 서버에 연결 시도 중...');
    console.log(`연결 대상: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}`);
    
    sshConn.connect(connectOptions);
  });
}

// 메인 테스트 함수
async function testConnection() {
  try {
    let finalConfig = { ...config };

    if (sshConfig.enabled) {
      console.log('🚇 SSH 터널링을 시작합니다...');
      const localPort = await createSSHTunnel();
      finalConfig.host = 'localhost';
      finalConfig.port = localPort;
      console.log(`🔄 SSH 터널을 통해 MySQL에 연결 시도: localhost:${localPort}`);
    } else {
      console.log('📍 로컬 MySQL에 직접 연결 시도');
    }

    console.log('');
    console.log('🔄 MySQL 연결 시도 중...');
    const connection = await mysql.createConnection(finalConfig);
    console.log('✅ MySQL 연결 성공!');
    
    // 간단한 쿼리 테스트
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ 쿼리 테스트 성공:', rows);
    
    await connection.end();
    console.log('✅ 연결 종료');
    
  } catch (error) {
    console.error('❌ 연결 실패:', error.message);
  } finally {
    // 정리
    if (sshServer) {
      sshServer.close();
      console.log('🔒 SSH 터널 서버 종료');
    }
    if (sshClient) {
      sshClient.end();
      console.log('🔒 SSH 클라이언트 종료');
    }
  }
}

// 테스트 실행
testConnection().then(() => {
  console.log('=== 테스트 완료 ===');
  process.exit(0);
}).catch((error) => {
  console.error('=== 테스트 실패 ===', error);
  process.exit(1);
}); 