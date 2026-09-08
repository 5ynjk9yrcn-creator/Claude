// The vendor catalog: how to recognise a vendor in a codebase, and where that
// vendor announces changes. This is the product's content asset — it ships as
// data, is versioned, and can be extended per-install without touching code.
//
// detect:
//   packages     dependency names, per ecosystem, as they appear in manifests
//   hosts        API hostnames that show up in source, config, and .env files
//   envVars      environment variable names that imply the integration
//   versionPins  header/param names whose value is a pinned API version
//   symbols      regexes for SDK call sites worth recording as endpoints
// sources:
//   kind rss|atom|json|html|eol|github_releases  + url
//
// A vendor with no sources is still useful: it shows up in the inventory and
// tells the user what is unmonitored.

export const CATALOG_VERSION = '2026.09.1';

export const VENDORS = [
  {
    slug: 'stripe', name: 'Stripe', category: 'payments',
    homepage: 'https://stripe.com', docs: 'https://docs.stripe.com/api',
    detect: {
      packages: { npm: ['stripe', '@stripe/stripe-js', '@stripe/react-stripe-js'], pypi: ['stripe'], go: ['github.com/stripe/stripe-go'], ruby: ['stripe'], php: ['stripe/stripe-php'], java: ['com.stripe:stripe-java'] },
      hosts: ['api.stripe.com', 'files.stripe.com', 'connect.stripe.com', 'checkout.stripe.com'],
      envVars: ['STRIPE_SECRET_KEY', 'STRIPE_API_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
      versionPins: ['Stripe-Version', 'stripe_version', 'apiVersion'],
      symbols: ['stripe\\.(?:charges|customers|subscriptions|paymentIntents|checkout|invoices|prices|products|accounts|payouts|webhooks)\\.[a-zA-Z]+']
    },
    sources: [
      { kind: 'html', url: 'https://docs.stripe.com/changelog', label: 'API changelog' },
      { kind: 'html', url: 'https://docs.stripe.com/upgrades', label: 'API upgrades' },
      { kind: 'github_releases', url: 'https://github.com/stripe/stripe-node/releases.atom', label: 'stripe-node releases' }
    ]
  },
  {
    slug: 'twilio', name: 'Twilio', category: 'communications',
    homepage: 'https://twilio.com', docs: 'https://www.twilio.com/docs/usage/api',
    detect: {
      packages: { npm: ['twilio'], pypi: ['twilio'], go: ['github.com/twilio/twilio-go'], ruby: ['twilio-ruby'], php: ['twilio/sdk'], java: ['com.twilio.sdk:twilio'] },
      hosts: ['api.twilio.com', 'verify.twilio.com', 'lookups.twilio.com', 'conversations.twilio.com', 'messaging.twilio.com'],
      envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_API_KEY', 'TWILIO_MESSAGING_SERVICE_SID'],
      versionPins: [],
      symbols: ['client\\.messages\\.create', 'client\\.calls\\.create', 'client\\.verify\\.v2']
    },
    sources: [
      { kind: 'html', url: 'https://www.twilio.com/en-us/changelog', label: 'Changelog' },
      { kind: 'github_releases', url: 'https://github.com/twilio/twilio-node/releases.atom', label: 'twilio-node releases' }
    ]
  },
  {
    slug: 'sendgrid', name: 'SendGrid', category: 'email',
    homepage: 'https://sendgrid.com', docs: 'https://www.twilio.com/docs/sendgrid/api-reference',
    detect: {
      packages: { npm: ['@sendgrid/mail', '@sendgrid/client'], pypi: ['sendgrid'], ruby: ['sendgrid-ruby'], php: ['sendgrid/sendgrid'] },
      hosts: ['api.sendgrid.com'],
      envVars: ['SENDGRID_API_KEY'],
      versionPins: [],
      symbols: ['sgMail\\.send']
    },
    sources: [{ kind: 'github_releases', url: 'https://github.com/sendgrid/sendgrid-nodejs/releases.atom', label: 'SDK releases' }]
  },
  {
    slug: 'openai', name: 'OpenAI', category: 'ai',
    homepage: 'https://openai.com', docs: 'https://platform.openai.com/docs/api-reference',
    detect: {
      packages: { npm: ['openai'], pypi: ['openai'], go: ['github.com/sashabaranov/go-openai'], ruby: ['ruby-openai'] },
      hosts: ['api.openai.com'],
      envVars: ['OPENAI_API_KEY', 'OPENAI_ORG_ID', 'OPENAI_BASE_URL'],
      versionPins: ['OpenAI-Beta'],
      symbols: ['(?:client|openai)\\.(?:chat\\.completions|completions|embeddings|images|audio|responses|assistants|files|batches)\\.[a-zA-Z]+', 'gpt-[0-9][a-zA-Z0-9.\\-]*', 'text-embedding-[a-z0-9\\-]+']
    },
    sources: [
      { kind: 'html', url: 'https://platform.openai.com/docs/changelog', label: 'API changelog' },
      { kind: 'html', url: 'https://platform.openai.com/docs/deprecations', label: 'Deprecations' }
    ]
  },
  {
    slug: 'anthropic', name: 'Anthropic', category: 'ai',
    homepage: 'https://www.anthropic.com', docs: 'https://docs.claude.com/en/api',
    detect: {
      packages: { npm: ['@anthropic-ai/sdk', '@anthropic-ai/bedrock-sdk', '@anthropic-ai/vertex-sdk'], pypi: ['anthropic'], go: ['github.com/anthropics/anthropic-sdk-go'] },
      hosts: ['api.anthropic.com'],
      envVars: ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'],
      versionPins: ['anthropic-version', 'anthropic-beta'],
      symbols: ['claude-[a-z0-9.\\-]+', '(?:client|anthropic)\\.(?:messages|completions|beta|models)\\.[a-zA-Z]+']
    },
    sources: [
      { kind: 'html', url: 'https://docs.claude.com/en/release-notes/api', label: 'API release notes' },
      { kind: 'html', url: 'https://docs.claude.com/en/docs/about-claude/model-deprecations', label: 'Model deprecations' },
      { kind: 'github_releases', url: 'https://github.com/anthropics/anthropic-sdk-typescript/releases.atom', label: 'SDK releases' }
    ]
  },
  {
    slug: 'google-gemini', name: 'Google Gemini API', category: 'ai',
    homepage: 'https://ai.google.dev', docs: 'https://ai.google.dev/gemini-api/docs',
    detect: {
      packages: { npm: ['@google/generative-ai', '@google/genai'], pypi: ['google-generativeai', 'google-genai'] },
      hosts: ['generativelanguage.googleapis.com'],
      envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
      versionPins: [],
      symbols: ['gemini-[a-z0-9.\\-]+']
    },
    sources: [{ kind: 'html', url: 'https://ai.google.dev/gemini-api/docs/changelog', label: 'API changelog' }]
  },
  {
    slug: 'github', name: 'GitHub', category: 'devtools',
    homepage: 'https://github.com', docs: 'https://docs.github.com/rest',
    detect: {
      packages: { npm: ['@octokit/rest', '@octokit/core', 'octokit', '@actions/github'], pypi: ['PyGithub', 'ghapi'], go: ['github.com/google/go-github'], ruby: ['octokit'] },
      hosts: ['api.github.com', 'uploads.github.com', 'raw.githubusercontent.com'],
      envVars: ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY'],
      versionPins: ['X-GitHub-Api-Version'],
      symbols: ['octokit\\.(?:rest\\.)?[a-zA-Z]+\\.[a-zA-Z]+', 'actions/(?:checkout|setup-node|setup-python|cache|upload-artifact|download-artifact)@v[0-9]+']
    },
    sources: [
      { kind: 'rss', url: 'https://github.blog/changelog/feed/', label: 'Changelog' },
      { kind: 'html', url: 'https://docs.github.com/en/rest/overview/breaking-changes', label: 'REST breaking changes' }
    ]
  },
  {
    slug: 'slack', name: 'Slack', category: 'communications',
    homepage: 'https://slack.com', docs: 'https://api.slack.com',
    detect: {
      packages: { npm: ['@slack/web-api', '@slack/bolt', '@slack/webhook', '@slack/events-api'], pypi: ['slack_sdk', 'slack-bolt', 'slackclient'] },
      hosts: ['slack.com/api', 'hooks.slack.com', 'api.slack.com'],
      envVars: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_WEBHOOK_URL', 'SLACK_APP_TOKEN'],
      versionPins: [],
      symbols: ['(?:chat|conversations|users|files|views)\\.[a-zA-Z]+']
    },
    sources: [{ kind: 'html', url: 'https://api.slack.com/changelog', label: 'Platform changelog' }]
  },
  {
    slug: 'shopify', name: 'Shopify', category: 'commerce',
    homepage: 'https://shopify.com', docs: 'https://shopify.dev/docs/api',
    detect: {
      packages: { npm: ['@shopify/shopify-api', '@shopify/shopify-app-express', '@shopify/admin-api-client'], pypi: ['ShopifyAPI'], ruby: ['shopify_api'] },
      hosts: ['myshopify.com/admin/api', 'shopify.com/api'],
      envVars: ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_ACCESS_TOKEN'],
      versionPins: ['X-Shopify-Api-Version', 'apiVersion'],
      symbols: ['/admin/api/20[0-9]{2}-[0-9]{2}/']
    },
    sources: [
      { kind: 'rss', url: 'https://shopify.dev/changelog/feed.xml', label: 'Developer changelog' },
      { kind: 'html', url: 'https://shopify.dev/docs/api/usage/versioning', label: 'API versioning' }
    ]
  },
  {
    slug: 'aws', name: 'Amazon Web Services', category: 'cloud',
    homepage: 'https://aws.amazon.com', docs: 'https://docs.aws.amazon.com',
    detect: {
      packages: { npm: ['aws-sdk', '@aws-sdk/client-s3', '@aws-sdk/client-dynamodb', '@aws-sdk/client-sqs', '@aws-sdk/client-ses', '@aws-sdk/client-lambda', '@aws-sdk/client-secrets-manager'], pypi: ['boto3', 'botocore', 'aioboto3'], go: ['github.com/aws/aws-sdk-go', 'github.com/aws/aws-sdk-go-v2'], ruby: ['aws-sdk'], java: ['software.amazon.awssdk:s3'] },
      hosts: ['amazonaws.com', 's3.amazonaws.com', 'sqs.amazonaws.com', 'lambda.amazonaws.com'],
      envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_LAMBDA_FUNCTION_NAME'],
      versionPins: ['nodejs[0-9]+\\.x', 'python3\\.[0-9]+', 'apiVersion'],
      symbols: ['new (?:S3|DynamoDB|SQS|SES|Lambda|SecretsManager)Client', 'boto3\\.client\\([\'"][a-z0-9\\-]+[\'"]\\)']
    },
    sources: [
      { kind: 'rss', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', label: "What's new" },
      { kind: 'html', url: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html', label: 'Lambda runtime support' }
    ]
  },
  {
    slug: 'google-cloud', name: 'Google Cloud', category: 'cloud',
    homepage: 'https://cloud.google.com', docs: 'https://cloud.google.com/apis',
    detect: {
      packages: { npm: ['@google-cloud/storage', '@google-cloud/bigquery', '@google-cloud/pubsub', 'googleapis'], pypi: ['google-cloud-storage', 'google-cloud-bigquery', 'google-api-python-client'], go: ['cloud.google.com/go'] },
      hosts: ['storage.googleapis.com', 'bigquery.googleapis.com', 'pubsub.googleapis.com', 'run.googleapis.com', 'cloudfunctions.net', 'www.googleapis.com'],
      envVars: ['GOOGLE_APPLICATION_CREDENTIALS', 'GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT'],
      versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://cloud.google.com/feeds/gcp-release-notes.xml', label: 'Release notes' }]
  },
  {
    slug: 'cloudflare', name: 'Cloudflare', category: 'cloud',
    homepage: 'https://cloudflare.com', docs: 'https://developers.cloudflare.com/api',
    detect: {
      packages: { npm: ['cloudflare', 'wrangler', '@cloudflare/workers-types', 'miniflare'], pypi: ['cloudflare'] },
      hosts: ['api.cloudflare.com', 'workers.dev'],
      envVars: ['CLOUDFLARE_API_TOKEN', 'CF_API_KEY', 'CLOUDFLARE_ACCOUNT_ID'],
      versionPins: ['compatibility_date'], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://developers.cloudflare.com/changelog/index.xml', label: 'Changelog' }]
  },
  {
    slug: 'vercel', name: 'Vercel', category: 'hosting',
    homepage: 'https://vercel.com', docs: 'https://vercel.com/docs/rest-api',
    detect: {
      packages: { npm: ['vercel', '@vercel/node', '@vercel/edge', '@vercel/blob', '@vercel/kv', '@vercel/postgres'] },
      hosts: ['api.vercel.com', 'vercel.app'],
      envVars: ['VERCEL_TOKEN', 'VERCEL_URL', 'VERCEL_ENV'],
      versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://vercel.com/changelog/rss.xml', label: 'Changelog' }]
  },
  {
    slug: 'netlify', name: 'Netlify', category: 'hosting',
    homepage: 'https://netlify.com', docs: 'https://docs.netlify.com/api/get-started/',
    detect: {
      packages: { npm: ['netlify', 'netlify-cli', '@netlify/functions'] },
      hosts: ['api.netlify.com', 'netlify.app'],
      envVars: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://www.netlify.com/changelog/rss.xml', label: 'Changelog' }]
  },
  {
    slug: 'supabase', name: 'Supabase', category: 'database',
    homepage: 'https://supabase.com', docs: 'https://supabase.com/docs/reference',
    detect: {
      packages: { npm: ['@supabase/supabase-js', '@supabase/auth-helpers-nextjs', '@supabase/ssr'], pypi: ['supabase'] },
      hosts: ['supabase.co', 'supabase.in'],
      envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'],
      versionPins: [], symbols: ['supabase\\.(?:from|rpc|auth|storage|functions)\\(?']
    },
    sources: [
      { kind: 'github_releases', url: 'https://github.com/supabase/supabase-js/releases.atom', label: 'supabase-js releases' },
      { kind: 'html', url: 'https://supabase.com/changelog', label: 'Changelog' }
    ]
  },
  {
    slug: 'firebase', name: 'Firebase', category: 'database',
    homepage: 'https://firebase.google.com', docs: 'https://firebase.google.com/docs/reference',
    detect: {
      packages: { npm: ['firebase', 'firebase-admin', 'firebase-functions', '@react-native-firebase/app'], pypi: ['firebase-admin'] },
      hosts: ['firebaseio.com', 'firebaseapp.com', 'firestore.googleapis.com', 'fcm.googleapis.com'],
      envVars: ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID', 'GOOGLE_APPLICATION_CREDENTIALS'],
      versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://firebase.google.com/support/releases', label: 'Release notes' }]
  },
  {
    slug: 'auth0', name: 'Auth0', category: 'identity',
    homepage: 'https://auth0.com', docs: 'https://auth0.com/docs/api',
    detect: {
      packages: { npm: ['auth0', '@auth0/auth0-react', '@auth0/nextjs-auth0', 'express-openid-connect'], pypi: ['auth0-python'] },
      hosts: ['auth0.com', 'us.auth0.com', 'eu.auth0.com'],
      envVars: ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_AUDIENCE'],
      versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://auth0.com/changelog/rss.xml', label: 'Changelog' }]
  },
  {
    slug: 'okta', name: 'Okta', category: 'identity',
    homepage: 'https://okta.com', docs: 'https://developer.okta.com/docs/reference/',
    detect: {
      packages: { npm: ['@okta/okta-sdk-nodejs', '@okta/okta-auth-js'], pypi: ['okta'] },
      hosts: ['okta.com/api/v1', 'oktapreview.com'],
      envVars: ['OKTA_DOMAIN', 'OKTA_API_TOKEN', 'OKTA_CLIENT_ID'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.okta.com/docs/release-notes/', label: 'Release notes' }]
  },
  {
    slug: 'plaid', name: 'Plaid', category: 'fintech',
    homepage: 'https://plaid.com', docs: 'https://plaid.com/docs/api/',
    detect: {
      packages: { npm: ['plaid', 'react-plaid-link'], pypi: ['plaid-python'], ruby: ['plaid'] },
      hosts: ['production.plaid.com', 'sandbox.plaid.com', 'development.plaid.com'],
      envVars: ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENV'],
      versionPins: ['Plaid-Version'], symbols: ['/(?:link/token|item|accounts|transactions|auth)/[a-z/]+']
    },
    sources: [{ kind: 'html', url: 'https://plaid.com/docs/changelog/', label: 'API changelog' }]
  },
  {
    slug: 'paypal', name: 'PayPal', category: 'payments',
    homepage: 'https://paypal.com', docs: 'https://developer.paypal.com/api/rest/',
    detect: {
      packages: { npm: ['@paypal/checkout-server-sdk', '@paypal/react-paypal-js', '@paypal/paypal-server-sdk'], pypi: ['paypalrestsdk'] },
      hosts: ['api-m.paypal.com', 'api.paypal.com', 'api-m.sandbox.paypal.com'],
      envVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.paypal.com/api/rest/release-notes/', label: 'Release notes' }]
  },
  {
    slug: 'square', name: 'Square', category: 'payments',
    homepage: 'https://squareup.com', docs: 'https://developer.squareup.com/reference/square',
    detect: {
      packages: { npm: ['square'], pypi: ['squareup'], ruby: ['square.rb'] },
      hosts: ['connect.squareup.com', 'connect.squareupsandbox.com'],
      envVars: ['SQUARE_ACCESS_TOKEN', 'SQUARE_APPLICATION_ID'],
      versionPins: ['Square-Version'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.squareup.com/docs/changelog/connect', label: 'Connect API changelog' }]
  },
  {
    slug: 'meta-graph', name: 'Meta Graph API', category: 'social',
    homepage: 'https://developers.facebook.com', docs: 'https://developers.facebook.com/docs/graph-api',
    detect: {
      packages: { npm: ['facebook-nodejs-business-sdk'], pypi: ['facebook-business'] },
      hosts: ['graph.facebook.com', 'graph.instagram.com'],
      envVars: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'META_ACCESS_TOKEN'],
      versionPins: ['/v[0-9]+\\.[0-9]+/'], symbols: ['graph\\.facebook\\.com/v[0-9]+\\.[0-9]+']
    },
    sources: [{ kind: 'html', url: 'https://developers.facebook.com/docs/graph-api/changelog', label: 'Graph API changelog' }]
  },
  {
    slug: 'notion', name: 'Notion', category: 'productivity',
    homepage: 'https://notion.so', docs: 'https://developers.notion.com/reference',
    detect: {
      packages: { npm: ['@notionhq/client'], pypi: ['notion-client'] },
      hosts: ['api.notion.com'],
      envVars: ['NOTION_API_KEY', 'NOTION_TOKEN', 'NOTION_DATABASE_ID'],
      versionPins: ['Notion-Version'], symbols: ['notion\\.(?:databases|pages|blocks|users|search)\\.[a-zA-Z]+']
    },
    sources: [{ kind: 'html', url: 'https://developers.notion.com/page/changelog', label: 'Changelog' }]
  },
  {
    slug: 'airtable', name: 'Airtable', category: 'productivity',
    homepage: 'https://airtable.com', docs: 'https://airtable.com/developers/web/api/introduction',
    detect: {
      packages: { npm: ['airtable'], pypi: ['pyairtable'] },
      hosts: ['api.airtable.com'],
      envVars: ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_TOKEN'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://airtable.com/developers/web/api/changelog', label: 'API changelog' }]
  },
  {
    slug: 'hubspot', name: 'HubSpot', category: 'crm',
    homepage: 'https://hubspot.com', docs: 'https://developers.hubspot.com/docs/api/overview',
    detect: {
      packages: { npm: ['@hubspot/api-client'], pypi: ['hubspot-api-client'] },
      hosts: ['api.hubapi.com'],
      envVars: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_API_KEY'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://developers.hubspot.com/changelog/rss.xml', label: 'Changelog' }]
  },
  {
    slug: 'salesforce', name: 'Salesforce', category: 'crm',
    homepage: 'https://salesforce.com', docs: 'https://developer.salesforce.com/docs/apis',
    detect: {
      packages: { npm: ['jsforce', '@salesforce/core'], pypi: ['simple-salesforce'] },
      hosts: ['salesforce.com/services/data', 'my.salesforce.com'],
      envVars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_USERNAME', 'SF_LOGIN_URL'],
      versionPins: ['/services/data/v[0-9.]+/'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest_deprecated_calls.htm', label: 'Deprecated REST calls' }]
  },
  {
    slug: 'zendesk', name: 'Zendesk', category: 'support',
    homepage: 'https://zendesk.com', docs: 'https://developer.zendesk.com/api-reference/',
    detect: {
      packages: { npm: ['node-zendesk'], pypi: ['zenpy'] },
      hosts: ['zendesk.com/api/v2'],
      envVars: ['ZENDESK_API_TOKEN', 'ZENDESK_SUBDOMAIN'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.zendesk.com/api-reference/ticketing/introduction/#api-changelog', label: 'API changelog' }]
  },
  {
    slug: 'intercom', name: 'Intercom', category: 'support',
    homepage: 'https://intercom.com', docs: 'https://developers.intercom.com/docs/references/rest-api/',
    detect: {
      packages: { npm: ['intercom-client'], pypi: ['python-intercom'] },
      hosts: ['api.intercom.io'],
      envVars: ['INTERCOM_ACCESS_TOKEN', 'INTERCOM_APP_ID'],
      versionPins: ['Intercom-Version'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/changelog', label: 'API changelog' }]
  },
  {
    slug: 'atlassian', name: 'Atlassian (Jira / Confluence)', category: 'devtools',
    homepage: 'https://atlassian.com', docs: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    detect: {
      packages: { npm: ['jira-client', 'jira.js'], pypi: ['jira', 'atlassian-python-api'] },
      hosts: ['atlassian.net/rest/api', 'api.atlassian.com'],
      envVars: ['JIRA_API_TOKEN', 'JIRA_BASE_URL', 'ATLASSIAN_API_TOKEN'],
      versionPins: ['/rest/api/[0-9]+'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developer.atlassian.com/changelog/', label: 'Developer changelog' }]
  },
  {
    slug: 'zoom', name: 'Zoom', category: 'communications',
    homepage: 'https://zoom.us', docs: 'https://developers.zoom.us/docs/api/',
    detect: {
      packages: { npm: ['@zoom/videosdk'], pypi: [] },
      hosts: ['api.zoom.us'],
      envVars: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://developers.zoom.us/changelog/', label: 'Changelog' }]
  },
  {
    slug: 'discord', name: 'Discord', category: 'communications',
    homepage: 'https://discord.com', docs: 'https://discord.com/developers/docs/reference',
    detect: {
      packages: { npm: ['discord.js', '@discordjs/rest', 'discord-api-types'], pypi: ['discord.py'] },
      hosts: ['discord.com/api', 'discordapp.com/api'],
      envVars: ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_WEBHOOK_URL'],
      versionPins: ['/api/v[0-9]+'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://discord.com/developers/docs/change-log', label: 'Change log' }]
  },
  {
    slug: 'sentry', name: 'Sentry', category: 'observability',
    homepage: 'https://sentry.io', docs: 'https://docs.sentry.io/api/',
    detect: {
      packages: { npm: ['@sentry/node', '@sentry/browser', '@sentry/react', '@sentry/nextjs'], pypi: ['sentry-sdk'], go: ['github.com/getsentry/sentry-go'] },
      hosts: ['sentry.io/api', 'ingest.sentry.io'],
      envVars: ['SENTRY_DSN', 'SENTRY_AUTH_TOKEN', 'SENTRY_ORG'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'github_releases', url: 'https://github.com/getsentry/sentry-javascript/releases.atom', label: 'SDK releases' }]
  },
  {
    slug: 'datadog', name: 'Datadog', category: 'observability',
    homepage: 'https://datadoghq.com', docs: 'https://docs.datadoghq.com/api/latest/',
    detect: {
      packages: { npm: ['dd-trace', '@datadog/browser-rum', '@datadog/datadog-api-client'], pypi: ['datadog', 'ddtrace'] },
      hosts: ['api.datadoghq.com', 'api.datadoghq.eu'],
      envVars: ['DD_API_KEY', 'DATADOG_API_KEY', 'DD_APP_KEY'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'github_releases', url: 'https://github.com/DataDog/dd-trace-js/releases.atom', label: 'dd-trace-js releases' }]
  },
  {
    slug: 'segment', name: 'Segment', category: 'analytics',
    homepage: 'https://segment.com', docs: 'https://segment.com/docs/connections/sources/catalog/',
    detect: {
      packages: { npm: ['@segment/analytics-node', 'analytics-node', '@segment/analytics-next'], pypi: ['analytics-python'] },
      hosts: ['api.segment.io', 'cdn.segment.com'],
      envVars: ['SEGMENT_WRITE_KEY'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'github_releases', url: 'https://github.com/segmentio/analytics-next/releases.atom', label: 'SDK releases' }]
  },
  {
    slug: 'mailchimp', name: 'Mailchimp', category: 'email',
    homepage: 'https://mailchimp.com', docs: 'https://mailchimp.com/developer/marketing/api/',
    detect: {
      packages: { npm: ['@mailchimp/mailchimp_marketing'], pypi: ['mailchimp-marketing'] },
      hosts: ['api.mailchimp.com'],
      envVars: ['MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER_PREFIX'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://mailchimp.com/developer/release-notes/', label: 'Release notes' }]
  },
  {
    slug: 'resend', name: 'Resend', category: 'email',
    homepage: 'https://resend.com', docs: 'https://resend.com/docs/api-reference',
    detect: {
      packages: { npm: ['resend'], pypi: ['resend'] },
      hosts: ['api.resend.com'],
      envVars: ['RESEND_API_KEY'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://resend.com/changelog', label: 'Changelog' }]
  },
  {
    slug: 'postmark', name: 'Postmark', category: 'email',
    homepage: 'https://postmarkapp.com', docs: 'https://postmarkapp.com/developer',
    detect: {
      packages: { npm: ['postmark'], pypi: ['postmarker'] },
      hosts: ['api.postmarkapp.com'],
      envVars: ['POSTMARK_SERVER_TOKEN', 'POSTMARK_API_TOKEN'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://postmarkapp.com/changelog', label: 'Changelog' }]
  },
  {
    slug: 'openai-azure', name: 'Azure OpenAI', category: 'ai',
    homepage: 'https://azure.microsoft.com', docs: 'https://learn.microsoft.com/azure/ai-services/openai/reference',
    detect: {
      packages: { npm: ['@azure/openai'], pypi: ['azure-ai-openai'] },
      hosts: ['openai.azure.com'],
      envVars: ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT'],
      versionPins: ['api-version'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation', label: 'API version deprecations' }]
  },
  {
    slug: 'microsoft-graph', name: 'Microsoft Graph', category: 'productivity',
    homepage: 'https://developer.microsoft.com/graph', docs: 'https://learn.microsoft.com/graph/api/overview',
    detect: {
      packages: { npm: ['@microsoft/microsoft-graph-client', '@azure/msal-node', '@azure/msal-browser'], pypi: ['msgraph-sdk', 'msal'] },
      hosts: ['graph.microsoft.com', 'login.microsoftonline.com'],
      envVars: ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET'],
      versionPins: ['graph\\.microsoft\\.com/(?:v1\\.0|beta)'], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://developer.microsoft.com/en-us/graph/changelog/rss', label: 'Graph changelog' }]
  },
  {
    slug: 'redis', name: 'Redis', category: 'database',
    homepage: 'https://redis.io', docs: 'https://redis.io/docs/latest/',
    detect: {
      packages: { npm: ['redis', 'ioredis', '@upstash/redis'], pypi: ['redis'], go: ['github.com/redis/go-redis'] },
      hosts: ['upstash.io'],
      envVars: ['REDIS_URL', 'REDIS_HOST', 'UPSTASH_REDIS_REST_URL'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'eol', url: 'https://endoflife.date/api/redis.json', label: 'Version support' }]
  },
  {
    slug: 'postgresql', name: 'PostgreSQL', category: 'database',
    homepage: 'https://postgresql.org', docs: 'https://www.postgresql.org/docs/',
    detect: {
      packages: { npm: ['pg', 'postgres', 'knex', 'prisma', 'typeorm', 'drizzle-orm'], pypi: ['psycopg2', 'psycopg', 'asyncpg', 'SQLAlchemy'], go: ['github.com/lib/pq', 'github.com/jackc/pgx'] },
      hosts: [],
      envVars: ['DATABASE_URL', 'POSTGRES_URL', 'PGHOST', 'PGDATABASE'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'eol', url: 'https://endoflife.date/api/postgresql.json', label: 'Version support' }]
  },
  {
    slug: 'nodejs', name: 'Node.js', category: 'runtime',
    homepage: 'https://nodejs.org', docs: 'https://nodejs.org/api/',
    detect: {
      packages: {}, hosts: [],
      envVars: ['NODE_ENV', 'NODE_VERSION'],
      versionPins: ['"node":\\s*"[^"]+"', 'node-version:\\s*[0-9.]+', 'FROM node:[0-9]+'], symbols: []
    },
    sources: [
      { kind: 'eol', url: 'https://endoflife.date/api/nodejs.json', label: 'Release schedule' },
      { kind: 'rss', url: 'https://nodejs.org/en/feed/blog.xml', label: 'Blog / security releases' }
    ]
  },
  {
    slug: 'python', name: 'Python', category: 'runtime',
    homepage: 'https://python.org', docs: 'https://docs.python.org/3/',
    detect: {
      packages: {}, hosts: [],
      envVars: ['PYTHON_VERSION'],
      versionPins: ['python_requires\\s*=\\s*[^\\n]+', 'python-version:\\s*[0-9.]+', 'FROM python:[0-9.]+'], symbols: []
    },
    sources: [{ kind: 'eol', url: 'https://endoflife.date/api/python.json', label: 'Release schedule' }]
  },
  {
    slug: 'react-native', name: 'React Native / Expo', category: 'mobile',
    homepage: 'https://reactnative.dev', docs: 'https://reactnative.dev/docs/getting-started',
    detect: {
      packages: { npm: ['react-native', 'expo', 'expo-router', 'expo-updates', '@expo/cli'] },
      hosts: ['expo.dev', 'exp.host'],
      envVars: ['EXPO_TOKEN', 'EXPO_PUBLIC_API_URL'], versionPins: ['"expo":\\s*"[^"]+"'], symbols: []
    },
    sources: [
      { kind: 'github_releases', url: 'https://github.com/expo/expo/releases.atom', label: 'Expo SDK releases' },
      { kind: 'html', url: 'https://docs.expo.dev/versions/latest/', label: 'SDK version support' }
    ]
  },
  {
    slug: 'apple-appstore', name: 'Apple App Store', category: 'mobile',
    homepage: 'https://developer.apple.com', docs: 'https://developer.apple.com/app-store/review/guidelines/',
    detect: {
      packages: { npm: ['react-native', 'expo'] },
      hosts: ['api.appstoreconnect.apple.com', 'itunes.apple.com'],
      envVars: ['APP_STORE_CONNECT_KEY_ID', 'ASC_KEY_ID', 'APPLE_TEAM_ID'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://developer.apple.com/news/releases/rss/releases.rss', label: 'Developer releases' }]
  },
  {
    slug: 'google-play', name: 'Google Play', category: 'mobile',
    homepage: 'https://play.google.com', docs: 'https://developer.android.com/distribute',
    detect: {
      packages: { npm: ['react-native', 'expo'] },
      hosts: ['androidpublisher.googleapis.com', 'play.google.com'],
      envVars: ['GOOGLE_PLAY_SERVICE_ACCOUNT', 'ANDROID_PACKAGE_NAME'],
      versionPins: ['targetSdkVersion\\s*=?\\s*[0-9]+', 'compileSdkVersion\\s*=?\\s*[0-9]+'], symbols: []
    },
    sources: [{ kind: 'rss', url: 'https://android-developers.googleblog.com/feeds/posts/default', label: 'Android developers blog' }]
  },
  {
    slug: 'docker', name: 'Docker Hub', category: 'devtools',
    homepage: 'https://docker.com', docs: 'https://docs.docker.com/docker-hub/',
    detect: {
      packages: {}, hosts: ['registry.hub.docker.com', 'index.docker.io'],
      envVars: ['DOCKER_USERNAME', 'DOCKERHUB_TOKEN'], versionPins: ['FROM [a-z0-9./_-]+:[a-zA-Z0-9._-]+'], symbols: []
    },
    sources: [{ kind: 'html', url: 'https://docs.docker.com/engine/release-notes/', label: 'Engine release notes' }]
  },
  {
    slug: 'kubernetes', name: 'Kubernetes', category: 'infrastructure',
    homepage: 'https://kubernetes.io', docs: 'https://kubernetes.io/docs/reference/',
    detect: {
      packages: { npm: ['@kubernetes/client-node'], pypi: ['kubernetes'], go: ['k8s.io/client-go'] },
      hosts: [],
      envVars: ['KUBECONFIG', 'KUBERNETES_SERVICE_HOST'],
      versionPins: ['apiVersion:\\s*[a-z0-9./]+'], symbols: []
    },
    sources: [{ kind: 'eol', url: 'https://endoflife.date/api/kubernetes.json', label: 'Version support' }]
  },
  {
    slug: 'algolia', name: 'Algolia', category: 'search',
    homepage: 'https://algolia.com', docs: 'https://www.algolia.com/doc/api-reference/',
    detect: {
      packages: { npm: ['algoliasearch', 'react-instantsearch'], pypi: ['algoliasearch'] },
      hosts: ['algolia.net', 'algolianet.com'],
      envVars: ['ALGOLIA_APP_ID', 'ALGOLIA_API_KEY', 'ALGOLIA_ADMIN_KEY'], versionPins: [], symbols: []
    },
    sources: [{ kind: 'github_releases', url: 'https://github.com/algolia/algoliasearch-client-javascript/releases.atom', label: 'SDK releases' }]
  }
];

export const vendorBySlug = (slug) => VENDORS.find((v) => v.slug === slug) || null;
