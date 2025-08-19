# MS SQL Server MCP 프로젝트 생성 스크립트
param(
    [string]$ProjectPath = "D:\workspace\MCP\SQL_SERVER"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "MS SQL Server MCP 프로젝트 생성 스크립트" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 프로젝트 디렉토리 생성
Write-Host "프로젝트 디렉토리 생성 중: $ProjectPath" -ForegroundColor Yellow
if (!(Test-Path $ProjectPath)) {
    New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}
if (!(Test-Path "$ProjectPath\src")) {
    New-Item -ItemType Directory -Path "$ProjectPath\src" -Force | Out-Null
}

Set-Location $ProjectPath

# package.json 생성
Write-Host "package.json 생성 중..." -ForegroundColor Green
$packageJson = @"
{
  "name": "mssql-mcp-server",
  "version": "0.1.0",
  "description": "MS SQL Server MCP (Model Context Protocol) Server",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mssql-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "clean": "rimraf dist"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "mssql",
    "sql-server",
    "database",
    "ai",
    "claude"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "mssql": "^10.0.2"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/mssql": "^9.1.5",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "rimraf": "^5.0.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
"@
$packageJson | Out-File -FilePath "package.json" -Encoding UTF8

# tsconfig.json 생성
Write-Host "tsconfig.json 생성 중..." -ForegroundColor Green
$tsconfig = @"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
"@
$tsconfig | Out-File -FilePath "tsconfig.json" -Encoding UTF8

# .env.example 생성
Write-Host ".env.example 생성 중..." -ForegroundColor Green
$envExample = @"
DB_SERVER=localhost
DB_DATABASE=your_database
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_CERT=true
"@
$envExample | Out-File -FilePath ".env.example" -Encoding UTF8

# .gitignore 생성
Write-Host ".gitignore 생성 중..." -ForegroundColor Green
$gitignore = @"
node_modules/
dist/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
.vscode/
.idea/
*.swp
*.swo
"@
$gitignore | Out-File -FilePath ".gitignore" -Encoding UTF8

# README.md 생성
Write-Host "README.md 생성 중..." -ForegroundColor Green
$readme = @"
# MS SQL Server MCP Server

Microsoft SQL Server용 Model Context Protocol (MCP) 서버입니다.

## 설치

``````bash
npm install
npm run build
``````

## 환경 설정

``.env`` 파일을 생성하고 데이터베이스 연결 정보를 설정하세요:

``````env
DB_SERVER=localhost
DB_DATABASE=your_database
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_CERT=true
``````

## 사용법

### 개발 모드
``````bash
npm run dev
``````

### 프로덕션 모드
``````bash
npm run build
npm start
``````

## 지원 기능

- **query**: SQL 쿼리 실행 (안전한 SELECT 쿼리만)
- **list_tables**: 데이터베이스 테이블 목록 조회
- **describe_table**: 테이블 구조 확인
- **get_table_data**: 테이블 데이터 조회 (페이지네이션 지원)
- **search_table**: 조건부 데이터 검색

## Claude Desktop 설정

Claude Desktop의 ``claude_desktop_config.json`` 파일에 다음을 추가:

``````json
{
  "mcpServers": {
    "mssql": {
      "command": "node",
      "args": ["D:/workspace/MCP/SQL_SERVER/dist/index.js"],
      "env": {
        "DB_SERVER": "localhost",
        "DB_DATABASE": "your_database", 
        "DB_USER": "sa",
        "DB_PASSWORD": "your_password",
        "DB_ENCRYPT": "false",
        "DB_TRUST_CERT": "true"
      }
    }
  }
}
``````

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
"@
$readme | Out-File -FilePath "README.md" -Encoding UTF8

# src/index.ts 임시 파일 생성
Write-Host "src/index.ts 임시 파일 생성 중..." -ForegroundColor Green
$indexTs = @"
// TypeScript 코드는 별도로 복사해야 합니다.
// 제공된 TypeScript 코드를 이 파일에 붙여넣으세요.

console.log('MS SQL Server MCP Server를 시작하려면 실제 코드를 이 파일에 붙여넣으세요.');
"@
$indexTs | Out-File -FilePath "src\index.ts" -Encoding UTF8

# 개발 환경 설정 파일 생성
Write-Host "개발 환경 설정 파일 생성 중..." -ForegroundColor Green
Copy-Item ".env.example" ".env"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "프로젝트 생성 완료!" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. src\index.ts 파일에 제공된 TypeScript 코드를 붙여넣으세요" -ForegroundColor White
Write-Host "2. .env 파일을 편집하여 실제 데이터베이스 연결 정보를 입력하세요" -ForegroundColor White
Write-Host "3. npm install 명령어로 의존성을 설치하세요" -ForegroundColor White
Write-Host "4. npm run build 명령어로 빌드하세요" -ForegroundColor White
Write-Host "5. npm start 명령어로 서버를 실행하세요" -ForegroundColor White
Write-Host ""
Write-Host "현재 디렉토리: $ProjectPath" -ForegroundColor Cyan
Write-Host ""

# npm 패키지 설치 옵션
$installChoice = Read-Host "npm 패키지 설치를 시작하시겠습니까? (Y/N)"
if ($installChoice -eq "Y" -or $installChoice -eq "y") {
    Write-Host ""
    Write-Host "npm 패키지 설치 중..." -ForegroundColor Yellow
    
    try {
        & npm install
        Write-Host ""
        Write-Host "설치 완료!" -ForegroundColor Green
        
        $buildChoice = Read-Host "TypeScript 빌드를 실행하시겠습니까? (Y/N)"
        if ($buildChoice -eq "Y" -or $buildChoice -eq "y") {
            Write-Host ""
            Write-Host "주의: src\index.ts에 실제 코드를 먼저 붙여넣어야 합니다!" -ForegroundColor Red
            Read-Host "TypeScript 코드가 준비되었다면 Enter를 누르세요..."
            
            try {
                & npm run build
                Write-Host ""
                Write-Host "빌드 성공!" -ForegroundColor Green
                Write-Host "npm start 명령어로 서버를 실행할 수 있습니다." -ForegroundColor White
            }
            catch {
                Write-Host ""
                Write-Host "빌드 실패! src\index.ts 파일을 확인하세요." -ForegroundColor Red
                Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host ""
        Write-Host "npm 설치 실패!" -ForegroundColor Red
        Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "설정이 완료되었습니다!" -ForegroundColor Green
Write-Host ""

# VS Code로 프로젝트 열기 옵션
$vscodeChoice = Read-Host "VS Code로 프로젝트를 여시겠습니까? (Y/N)"
if ($vscodeChoice -eq "Y" -or $vscodeChoice -eq "y") {
    try {
        & code .
        Write-Host "VS Code가 실행되었습니다." -ForegroundColor Green
    }
    catch {
        Write-Host "VS Code를 실행할 수 없습니다. VS Code가 설치되어 있고 PATH에 등록되어 있는지 확인하세요." -ForegroundColor Red
    }
}

Read-Host "계속하려면 Enter를 누르세요..."