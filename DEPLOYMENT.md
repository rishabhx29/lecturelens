# LectureLens deployment guide

LectureLens turns a lecture PDF into a chat experience and a generated **Study Pack** with a summary, key concepts, flashcards, and a multiple-choice quiz.

The app is based on [`aws-samples/serverless-pdf-chat`](https://github.com/aws-samples/serverless-pdf-chat) (MIT-0) and adds the Study Pack pipeline and UI.

## Architecture

```
Browser
  │  Cognito ID token
  ▼
API Gateway (REST, Cognito authorizer)
  ├─ POST /doc/{id}/study-pack ──► RequestStudyPack Lambda ──► SQS StudyPackQueue
  ├─ GET  /doc/{id}/study-pack ──► GetStudyPack Lambda ──────► DynamoDB DocumentTable
  ├─ POST /{id}/{conversation} ──► GenerateResponse Lambda ──► local engine or Bedrock
  └─ other document/conversation routes
                                      SQS StudyPackQueue
                                              │
                                              ▼
                                   GenerateStudyPack Lambda
                                   ├─ reads the PDF from S3
                                   ├─ local study engine or Bedrock Converse
                                   └─ stores the pack + status in DynamoDB

Frontend: React + Vite, built locally, private S3 served by a small Lambda
          behind an API Gateway HTTP API (HTTPS)
```

Study Pack generation is asynchronous because API Gateway REST integrations time out after 29 seconds. The browser starts a job, polls the GET endpoint, and renders the result when it is ready.

## AI modes and the zero-cost default

The backend supports three modes via the `AiMode` SAM parameter:

| Mode | Behavior | Bedrock access |
|---|---|---|
| `local` (default) | Deterministic hashed embeddings, extractive answers, and a local Study Pack generator. The bundled cell-biology lecture gets a curated demo pack. | Not needed |
| `auto` | Tries Bedrock, falls back to local mode on access or runtime errors. | Required for Bedrock answers |
| `bedrock` | Requires Bedrock; failures are surfaced instead of hidden. | Required |

The AWS Free plan does **not** include Bedrock. Calls return `ValidationException: Operation not allowed`, even when the model appears active in the Bedrock console. Deploy with `AiMode=local` for the zero-cost demo. Local mode makes no Bedrock API calls.

## Prerequisites

- AWS account with permission to create IAM roles, Lambda functions, API Gateway (REST and HTTP APIs), Cognito, DynamoDB, S3, SQS, and CloudFormation resources.
- AWS CLI v2 and AWS SAM CLI. If they are not installed globally, a repo-local Python virtual environment is enough:

  ```powershell
  python -m venv .venv
  .\.venv\Scripts\python -m pip install --upgrade pip
  .\.venv\Scripts\python -m pip install aws-sam-cli awscli
  ```

  The deployment scripts automatically prepend `.venv\Scripts` to `PATH`, so they will use these copies.

- Python 3.11.
- Node.js 20 or newer.
- AWS credentials configured for the target account:

  ```powershell
  aws login --region us-east-1
  # or, for a named profile:
  aws configure --profile my-profile
  # or, for an SSO profile:
  aws sso login --profile my-profile
  ```

- The account should be on the **AWS Free plan** (the default for new accounts). Do not upgrade to Paid. Confirm the plan is active:

  ```powershell
  .\scripts\check-credits.ps1
  ```

  **AWS India accounts:** AWS requires a verified payment method to finish registration. In **Billing and Cost Management → Payment preferences**, add **UPI AutoPay** (no credit card) or a card and complete verification. This is identity verification, not a paid upgrade; the Free plan has no service charges. A card verification may show a small temporary hold that is refunded. If the account still shows `NOT_STARTED` after verification, open a free Basic Support case under **Account and billing → Account activation**.

- **Bedrock access (optional).** The default `local` mode does not use Bedrock and needs no model access. If you intentionally move to a Paid account and enable Bedrock, the backend defaults are:
  - `amazon.nova-pro-v1:0` for chat and Study Pack generation
  - `amazon.titan-embed-text-v2:0` for embeddings
  - Region: `us-east-1`

  Amazon Nova Pro is the default because Amazon models are usually available without a separate access request. You can switch to a Claude model that supports the Bedrock **Converse** API (for example `anthropic.claude-3-5-sonnet-20241022-v2:0`) with `-ModelId` once access is enabled. Then deploy with `-AiMode auto` or `-AiMode bedrock`. The Free plan still uses `local` mode; Bedrock is blocked there.

- **No budget alert is needed on the Free plan.** The plan cannot incur charges; it draws down the $100 credit balance and closes when the credits or six-month term are exhausted. Check the balance with:

  ```powershell
  .\scripts\check-credits.ps1
  ```

  `create-budget.ps1` remains available for anyone who intentionally upgrades to the Paid plan, but it is not part of this deployment.

## 1. Deploy the backend

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-backend.ps1 -AiMode local
```

Useful options:

```powershell
.\scripts\deploy-backend.ps1 `
  -StackName lecturelens `
  -Region us-east-1 `
  -AiMode local `
  -ModelId amazon.nova-pro-v1:0 `
  -EmbeddingModelId amazon.titan-embed-text-v2:0 `
  -BedrockRegion us-east-1
```

`-AiMode local` is the default and is required for a zero-cost Free-plan deployment. The build uses only pure-Python dependencies; `boto3` and `botocore` are provided by the Lambda runtime and are intentionally not bundled, which keeps each artifact around 1 MB.

If you use a named AWS profile:

```powershell
.\scripts\deploy-backend.ps1 -AwsProfile my-profile
```

The script runs `sam build` and `sam deploy`. The project uses only pure-Python Lambda dependencies, so Docker is not required on Windows. At the end it prints the stack outputs, including the API URL, Cognito user pool ID, and app client ID.

## 2. Create a login user

The Cognito user pool is configured for admin-created users only.

```powershell
.\scripts\create-demo-user.ps1 -Email you@example.com
```

The script prompts for a password and sets it as a permanent password. Password requirements: at least 8 characters with uppercase, lowercase, a number, and a symbol.

## 3. Deploy the frontend

```powershell
.\scripts\deploy-frontend.ps1
```

This script:

1. Creates a private S3 bucket, a small frontend Lambda, and an API Gateway HTTP API.
2. Reads the API and Cognito outputs from the backend stack.
3. Writes `frontend/.env.production`.
4. Runs `npm ci` and `npm run build`.
5. Uploads `frontend/dist` to S3. Hashed assets get a long cache lifetime; `index.html` is uploaded with `no-cache`.

The public HTTPS URL (an `execute-api` endpoint) is printed at the end. The Lambda serves SPA deep links by returning `index.html` for unknown paths, so browser refreshes on `/doc/...` work.

Sign in with the demo user and upload [`examples/cell-biology-lecture.pdf`](examples/cell-biology-lecture.pdf) to try chat and the Study Pack.

**CloudFront note:** new Free-plan accounts can see `Access denied ... Your account must be verified before you can add new CloudFront resources`. That is an account-verification restriction, not an app error. The default deployment avoids CloudFront entirely. `infra/frontend-cloudfront.yaml` is kept for accounts that already have CloudFront enabled and want the optional OAC setup.

To use a different prefix or stack name:

```powershell
.\scripts\deploy-frontend.ps1 `
  -BackendStackName lecturelens `
  -FrontendStackName lecturelens-frontend `
  -BucketPrefix lecturelens
```

## Local frontend development

After the backend is deployed, read its outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name lecturelens `
  --query "Stacks[0].Outputs" `
  --output table
```

Create `frontend/.env.development`:

```text
VITE_REGION=us-east-1
VITE_API_REGION=us-east-1
VITE_API_ENDPOINT=https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then:

```powershell
cd frontend
npm ci
npm run dev
```

## Configuration notes

- **Model access:** the model ID is a SAM parameter and is used only in `auto`/`bedrock` mode:
  `.\scripts\deploy-backend.ps1 -AiMode auto -ModelId anthropic.claude-3-5-sonnet-20241022-v2:0`
- **Bedrock region:** `auto`/`bedrock` call Bedrock in `BedrockRegion` (default `us-east-1`) even if the rest of the stack is deployed elsewhere. Enable model access in that region.
- **Cognito:** users must be created by an admin. There is no self-sign-up. The app client allows SRP and password auth for the private demo.
- **S3:** both the frontend and document buckets are private. The frontend Lambda reads the S3 objects with an IAM role; no objects are public.
- **CORS:** the document API is configured with `*` for demo convenience. Tighten it to the frontend API domain for a production deployment.
- **Free-plan limits:** Lambda memory is capped at 512 MB on the Free plan, so all functions use 512 MB. Keep PDFs reasonably small (the sample is 9 KB, 4 pages).
- **Study Pack cache:** the pack is stored as a DynamoDB attribute on the document item. Reopening the modal reads the cached result. To regenerate a completed pack, delete the document and upload it again; failed packs can be retried directly from the modal.

## Cost and free-plan notes

This deployment is designed to stay on the **AWS Free plan** with **no out-of-pocket charges**:

- The account includes **$100 in credits** (plus activity credits). S3 storage/requests, API Gateway requests, and other eligible usage draw from that balance.
- Lambda, DynamoDB, SQS, Cognito, and CloudWatch have Always Free monthly allowances. The demo should stay well inside them.
- The frontend uses a private S3 bucket, a 512 MB Lambda, and an HTTP API. There is no CloudFront distribution, NAT Gateway, provisioned concurrency, or paid support plan in the default stack.
- **Bedrock is not included in the Free plan.** The default `AiMode=local` makes no Bedrock calls. Do not switch to `auto`/`bedrock` on the Free plan expecting model access.
- **Do not upgrade to Paid.** If the credits are exhausted or the six-month term ends, AWS closes the account (with a 90-day recovery window) rather than billing you.
- Run `.\scripts\check-credits.ps1` before and after a demo. Large PDFs and repeated uploads consume more S3 and Lambda time.
- Delete the stacks when you are finished to stop consuming credits.

## Cleanup

1. Empty the document bucket created by the backend stack and the frontend bucket.
2. Delete the backend stack:

   ```powershell
   cd backend
   sam delete --stack-name lecturelens
   ```

3. Delete the frontend stack:

   ```powershell
   aws cloudformation delete-stack --stack-name lecturelens-frontend
   ```

4. If you created an artifact bucket for SAM, empty and delete it as well.

The default frontend stack has no CloudFront distribution, so cleanup is immediate. If you deployed the optional CloudFront template, distributions can take a few minutes to delete.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Every service returns `SubscriptionRequiredException` / `OptInRequired`, and `check-credits.ps1` shows `NOT_STARTED` | The new account has not finished registration/verification (common for AWS India accounts) | Complete payment-method verification in **Billing → Payment preferences** (UPI AutoPay or card), sign out/in, and wait up to 24 hours. If still stuck, open a free Basic Support case under **Account and billing → Account activation**. Do not upgrade to Paid. |
| `ValidationException: Operation not allowed` from Bedrock | Bedrock is not included in the AWS Free plan, even if models show as active | Deploy with `-AiMode local`; do not upgrade to Paid just for this demo |
| CloudFront deploy fails: `Your account must be verified before you can add new CloudFront resources` | New accounts need separate CloudFront verification | Use the default API Gateway HTTPS frontend; deploy `infra/frontend-cloudfront.yaml` only after AWS verifies the account |
| CloudFormation fails: `MemorySize ... greater than 512` | The Free plan caps Lambda memory at 512 MB | Keep all functions at 512 MB or lower; the template already does |
| SAM artifact upload stalls at 100% | Large upload / network path | Keep artifacts small. `boto3`/`botocore` are provided by Lambda and are intentionally not bundled |
| Login page rejects the user | User was created in a different user pool, or the password is temporary | Use `create-demo-user.ps1` with the stack's `CognitoUserPool` output |
| `npm ci` fails | Node version is too old | Install Node.js 20+ |
| `sam build` fails on Windows | A native dependency was added | Keep Lambda dependencies pure Python; the Study Pack code uses `boto3` + `pypdf` only |
| Chat request returns 504 | The model took longer than the API Gateway 29-second limit | Ask shorter questions, reduce `maxTokens`, or use a faster model |
| Study Pack stays `QUEUED` | The worker hit an error | Check the `GenerateStudyPackFunction` CloudWatch logs and the document's `studypackerror` attribute |

## Attribution

The base application is [`aws-samples/serverless-pdf-chat`](https://github.com/aws-samples/serverless-pdf-chat), licensed under MIT-0. LectureLens adds the Study Pack backend pipeline, the Study Pack UI, a deterministic local AI path, LectureLens branding, a Windows-friendly pure-Python deployment path, and a zero-cost HTTPS frontend host.
