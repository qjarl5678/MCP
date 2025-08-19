#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import sql from 'mssql';

// SQL Server 연결 설정
const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// 전역 연결 풀
let connectionPool: sql.ConnectionPool | null = null;

// 데이터베이스 연결 함수
async function getConnection(): Promise<sql.ConnectionPool> {
  if (!connectionPool) {
    connectionPool = new sql.ConnectionPool(config);
    await connectionPool.connect();
    console.error('SQL Server에 연결되었습니다.');
  }
  return connectionPool;
}

// 안전한 쿼리 검사 함수
function isSafeQuery(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  
  // 위험한 키워드들
  const dangerousKeywords = [
    'drop', 'delete', 'insert', 'update', 'alter', 'create',
    'truncate', 'exec', 'execute', 'sp_', 'xp_', 'merge',
    'bulk', 'openrowset', 'opendatasource'
  ];
  
  // 쿼리가 SELECT로 시작하는지 확인
  if (!normalizedQuery.startsWith('select') && !normalizedQuery.startsWith('with')) {
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
function formatSqlResult(recordset: any[]): string {
  if (!recordset || recordset.length === 0) {
    return '결과가 없습니다.';
  }
  
  // 테이블 형태로 포맷팅
  const headers = Object.keys(recordset[0]);
  const headerRow = '| ' + headers.join(' | ') + ' |';
  const separatorRow = '| ' + headers.map(() => '---').join(' | ') + ' |';
  
  const dataRows = recordset.map(row => 
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
    name: 'mssql-mcp-server',
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
              description: '실행할 SQL 쿼리 (SELECT 문만 허용)',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'list_tables',
        description: '데이터베이스의 모든 테이블 목록을 조회합니다',
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
            '안전하지 않은 쿼리입니다. SELECT 문만 허용됩니다.'
          );
        }

        const result = await pool.request().query(queryText);
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(result.recordset),
            },
          ],
        };
      }

      case 'list_tables': {
        const query = `
          SELECT 
            TABLE_SCHEMA as [스키마],
            TABLE_NAME as [테이블명],
            TABLE_TYPE as [테이블유형]
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_SCHEMA, TABLE_NAME
        `;
        
        const result = await pool.request().query(query);
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(result.recordset),
            },
          ],
        };
      }

      case 'describe_table': {
        const { table_name } = args as { table_name: string };
        
        const query = `
          SELECT 
            COLUMN_NAME as [컬럼명],
            DATA_TYPE as [데이터타입],
            CHARACTER_MAXIMUM_LENGTH as [최대길이],
            IS_NULLABLE as [NULL허용],
            COLUMN_DEFAULT as [기본값],
            ORDINAL_POSITION as [순서]
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `;
        
        const result = await pool.request()
          .input('tableName', sql.NVarChar, table_name)
          .query(query);
          
        if (result.recordset.length === 0) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `테이블 '${table_name}'을 찾을 수 없습니다.`
          );
        }
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(result.recordset),
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

        const query = `
          SELECT * FROM [${table_name}]
          ORDER BY (SELECT NULL)
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `;
        
        const result = await pool.request()
          .input('offset', sql.Int, offset)
          .input('limit', sql.Int, limit)
          .query(query);
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(result.recordset),
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

        const query = `
          SELECT TOP (@limit) * FROM [${table_name}]
          WHERE ${where_clause}
        `;
        
        const result = await pool.request()
          .input('limit', sql.Int, limit)
          .query(query);
        
        return {
          content: [
            {
              type: 'text',
              text: formatSqlResult(result.recordset),
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
    
    console.error('SQL 오류:', error);
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
  console.error('MS SQL Server MCP 서버가 시작되었습니다.');
}

// 프로세스 종료 시 연결 정리
process.on('SIGINT', async () => {
  if (connectionPool) {
    await connectionPool.close();
    console.error('SQL Server 연결이 종료되었습니다.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (connectionPool) {
    await connectionPool.close();
    console.error('SQL Server 연결이 종료되었습니다.');
  }
  process.exit(0);
});

main().catch((error) => {
  console.error('서버 시작 오류:', error);
  process.exit(1);
}); 