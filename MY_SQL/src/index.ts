#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import mysql from 'mysql2/promise';

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

// 전역 연결 풀
let connectionPool: mysql.Pool | null = null;

// 데이터베이스 연결 함수
async function getConnection(): Promise<mysql.Pool> {
  if (!connectionPool) {
    connectionPool = mysql.createPool(config);
    console.error('MySQL에 연결되었습니다.');
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
    
    console.error('MySQL 오류:', error);
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

// 프로세스 종료 시 연결 정리
process.on('SIGINT', async () => {
  if (connectionPool) {
    await connectionPool.end();
    console.error('MySQL 연결이 종료되었습니다.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (connectionPool) {
    await connectionPool.end();
    console.error('MySQL 연결이 종료되었습니다.');
  }
  process.exit(0);
});

main().catch((error) => {
  console.error('서버 시작 오류:', error);
  process.exit(1);
}); 