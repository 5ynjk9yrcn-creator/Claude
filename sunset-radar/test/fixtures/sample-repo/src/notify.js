import { WebClient } from '@slack/web-api';
import twilio from 'twilio';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const sms = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function alertOps(text) {
  await slack.chat.postMessage({ channel: '#ops', text });
  await fetch(process.env.SLACK_WEBHOOK_URL ?? 'https://hooks.slack.com/services/T000/B000/xxx', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
}

export async function textCustomer(to, body) {
  return sms.messages.create({ to, from: process.env.TWILIO_NUMBER, body });
}
