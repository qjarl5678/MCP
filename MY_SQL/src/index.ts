#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 단순하게 dotenv 로드
dotenvConfig({ path: path.join(__dirname, '../.env') });
console.error('dotenv 로드 시도 완료');
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';
import { Client } from 'ssh2';
import * as fs from 'fs';
import * as net from 'net';

// MySQL 연결 설정
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? {} : false,
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
};

// SSH 설정
const sshConfig = {
  enabled: process.env.SSH_ENABLED === 'true',
  host: process.env.SSH_HOST || '',
  port: parseInt(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USER || '',
  password: process.env.SSH_PASSWORD || '',
  privateKeyPath: process.env.SSH_PRIVATE_KEY_PATH || '',
  localPort: parseInt(process.env.SSH_LOCAL_PORT || '3307'),
};

// 디버깅: 환경변수 로딩 확인
console.error('=== 환경변수 디버깅 ===');
console.error('SSH_ENABLED:', process.env.SSH_ENABLED);
console.error('SSH_HOST:', process.env.SSH_HOST);
console.error('sshConfig.enabled:', sshConfig.enabled);
console.error('sshConfig.enabled:', sshConfig.enabled);
console.error('sshConfig.host:', sshConfig.host);
console.error('sshConfig.port:', sshConfig.port);
console.error('sshConfig.username:', sshConfig.username);
console.error('sshConfig.localPort:', sshConfig.localPort);
console.error('=====================');

// 전역 연결 풀 및 SSH 클라이언트
let connectionPool: mysql.Pool | null = null;
let sshClient: Client | null = null;
let sshServer: net.Server | null = null;

// SSH 터널 생성 함수
async function createSSHTunnel(): Promise<number> {
  return new Promise((resolve, reject) => {
    const sshConn = new Client();
    sshClient = sshConn;

    sshConn.on('ready', () => {
      console.error('SSH 연결이 성공했습니다.');
      
      // 로컬 서버 생성
      const server = net.createServer((sock) => {
        sshConn.forwardOut(
          sock.remoteAddress || '',
          sock.remotePort || 0,
          config.host,
          config.port,
          (err, stream) => {
            if (err) {
              console.error('SSH 포워딩 오류:', err);
              sock.end();
              return;
            }
            sock.pipe(stream).pipe(sock);
          }
        );
      });

      server.listen(sshConfig.localPort, 'localhost', () => {
        console.error(`SSH 터널이 localhost:${sshConfig.localPort}에서 시작되었습니다.`);
        sshServer = server;
        resolve(sshConfig.localPort);
      });

      server.on('error', (err) => {
        console.error('SSH 터널 서버 오류:', err);
        reject(err);
      });
    });

    sshConn.on('error', (err) => {
      console.error('SSH 연결 오류:', err);
      reject(err);
    });

    // SSH 연결 설정
    const connectOptions: any = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      timeout: 30000, // 30초 타임아웃
      readyTimeout: 30000, // 준비 타임아웃 30초
    };
    
    console.error('SSH 연결을 시도합니다:', connectOptions.host + ':' + connectOptions.port);

    if (sshConfig.privateKeyPath && fs.existsSync(sshConfig.privateKeyPath)) {
      connectOptions.privateKey = fs.readFileSync(sshConfig.privateKeyPath);
    } else if (sshConfig.password) {
      connectOptions.password = sshConfig.password;
    } else {
      reject(new Error('SSH 인증 정보가 없습니다. 비밀번호 또는 개인키를 설정하세요.'));
      return;
    }

    sshConn.connect(connectOptions);
  });
}

// 데이터베이스 연결 함수
async function getConnection(): Promise<mysql.Pool> {
  if (!connectionPool) {
    let finalConfig = { ...config };

    // SSH 터널링이 활성화된 경우
    if (sshConfig.enabled) {
      console.error('SSH 터널 생성을 시도합니다...');
      try {
        const localPort = await createSSHTunnel();
        finalConfig.host = 'localhost';
        finalConfig.port = localPort;
        console.error(`SSH 터널을 통해 MySQL에 연결합니다: localhost:${localPort}`);
      } catch (error) {
        console.error('SSH 터널 생성 실패:', error);
        throw error;
      }
    }

    try {
      console.error('MySQL 연결 풀 생성 중...');
      console.error('  host:', finalConfig.host);
      console.error('  port:', finalConfig.port);
      console.error('  database:', finalConfig.database);
      console.error('  user:', finalConfig.user);
      connectionPool = mysql.createPool(finalConfig);
      console.error('MySQL 연결 풀이 생성되었습니다.');
      
      // 연결 테스트
      const testConnection = await connectionPool.getConnection();
      console.error('MySQL 연결 테스트 성공!');
      testConnection.release();
      
    } catch (error) {
      console.error('MySQL 연결 중 오류 발생:', error);
      throw error;
    }
  }
  return connectionPool;
}

// 안전한 쿼리 검사 함수
function isSafeQuery(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  
  // 위험한 키워드들
  const dangerousKeywords = [
    'drop', 'delete', 'insert', 'update', 'alter', 'create',
    'truncate', 'replace', 'merge', 'call', 'exec', 'execute',
    'load', 'outfile', 'dumpfile', 'into outfile', 'into dumpfile'
  ];
  
  // 쿼리가 SELECT로 시작하는지 확인
  if (!normalizedQuery.startsWith('select') && 
      !normalizedQuery.startsWith('show') && 
      !normalizedQuery.startsWith('describe') &&
      !normalizedQuery.startsWith('desc') &&
      !normalizedQuery.startsWith('explain') &&
      !normalizedQuery.startsWith('with')) {
    return false;
  }
  
  // 위험한 키워드 검사
  for (const keyword of dangerousKeywords) {
    if (normalizedQuery.includes(keyword)) {
      return false;
    }
  }
  
  return true;
}

// SQL 결과를 문자열로 변환하는 함수
function formatSqlResult(rows: any[]): string {
  if (!rows || rows.length === 0) {
    return '결과가 없습니다.';
  }
  
  // 테이블 형태로 포맷팅
  const headers = Object.keys(rows[0]);
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
  
  const dataRows = rows.map(row => 
    '| ' + headers.map(header => {
      const value = row[header];
      return value === null || value === undefined ? 'NULL' : String(value);
    }).join(' | ') + ' |'
  );
  
  return [headerRow, separatorRow, ...dataRows].join('\n');
}

// MCP 서버 설정
const server = new Server(
  {
    name: 'mysql-mcp-server',
    version: '0.1.0',
  }
);

// 도구 목록 정의
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query',
        description: 'SQL 쿼리를 실행합니다 (읽기 전용)',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: '실행할 SQL 쿼리 (SELECT, SHOW, DESCRIBE, EXPLAIN만 허용)',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'list_databases',
        description: '모든 데이터베이스 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_tables',
        description: '현재 데이터베이스의 모든 테이블 목록을 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'describe_table',
        description: '특정 테이블의 구조를 조회합니다',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: '조회할 테이블 이름',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'get_table_data',
        description: '테이블의 데이터를 조회합니다 (페이지네이션 지원)',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: '조회할 테이블 이름',
            },
            limit: {
              type: 'number',
              description: '조회할 레코드 수 (기본값: 100)',
              default: 100,
            },
            offset: {
              type: 'number',
              description: '건너뛸 레코드 수 (기본값: 0)',
              default: 0,
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'search_table',
        description: '테이블에서 조건에 맞는 데이터를 검색합니다',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: '검색할 테이블 이름',
            },
            where_clause: {
              type: 'string',
              description: 'WHERE 절 조건 (WHERE 키워드 제외)',
            },
            limit: {
              type: 'number',
              description: '조회할 레코드 수 (기본값: 100)',
              default: 100,
            },
          },
          required: ['table_name', 'where_clause'],
        },
      },
    ],
  };
});

// 도구 호출 처리
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const pool = await getConnection();

    switch (name) {
      case 'query': {
        const { sql: queryText } = args as { sql: string };
        
        if (!isSafeQuery(queryText)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            '안전하지 않은 쿼리입니다. SELECT, SHOW, DESCRIBE, EXPLAIN 문만 허용됩니다.'
          );
        }

        const [rows] = await pool.execute(queryText);
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      case 'list_databases': {
        const query = 'SHOW DATABASES';
        const [rows] = await pool.execute(query);
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      case 'list_tables': {
        const query = 'SHOW TABLES';
        const [rows] = await pool.execute(query);
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      case 'describe_table': {
        const { table_name } = args as { table_name: string };
        
        const query = 'DESCRIBE ??';
        const [rows] = await pool.execute(query, [table_name]);
        
        if ((rows as any[]).length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `테이블 '${table_name}'을 찾을 수 없습니다.`
          );
        }
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      case 'get_table_data': {
        const { table_name, limit = 100, offset = 0 } = args as {
          table_name: string;
          limit?: number;
          offset?: number;
        };

        const query = 'SELECT * FROM ?? LIMIT ? OFFSET ?';
        const [rows] = await pool.execute(query, [table_name, limit, offset]);
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      case 'search_table': {
        const { table_name, where_clause, limit = 100 } = args as {
          table_name: string;
          where_clause: string;
          limit?: number;
        };

        // WHERE 절 안전성 검사
        if (!isSafeQuery(`SELECT * FROM ${table_name} WHERE ${where_clause}`)) {
          throw new McpError(
            ErrorCode.InvalidParams,
            '안전하지 않은 WHERE 절입니다.'
          );
        }

        const query = `SELECT * FROM ?? WHERE ${where_clause} LIMIT ?`;
        const [rows] = await pool.execute(query, [table_name, limit]);
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(rows as any[]),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `알 수 없는 도구: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    console.error('=== MySQL 오류 상세 정보 ===');
    console.error('오류 타입:', typeof error);
    console.error('오류 객체:', error);
    console.error('오류 메시지:', error instanceof Error ? error.message : String(error));
    console.error('스택 트레이스:', error instanceof Error ? error.stack : 'N/A');
    console.error('===========================');
    
    throw new McpError(
      ErrorCode.InternalError,
      `데이터베이스 오류: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MySQL MCP 서버가 시작되었습니다.');
}

// 연결 정리 함수
async function cleanup() {
  if (connectionPool) {
    await connectionPool.end();
    console.error('MySQL 연결이 종료되었습니다.');
  }
  
  if (sshServer) {
    sshServer.close();
    console.error('SSH 터널 서버가 종료되었습니다.');
  }
  
  if (sshClient) {
    sshClient.end();
    console.error('SSH 연결이 종료되었습니다.');
  }
}

// 프로세스 종료 시 연결 정리
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

console.error('=== 서버 시작 시도 ===');

main().catch((error) => {
  console.error('=== 서버 시작 오류 ===');
  console.error('오류 타입:', typeof error);
  console.error('오류 객체:', error);
  console.error('오류 메시지:', error instanceof Error ? error.message : String(error));
  console.error('스택 트레이스:', error instanceof Error ? error.stack : 'N/A');
  console.error('====================');
  process.exit(1);
}); 