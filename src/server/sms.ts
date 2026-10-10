/**
 * SMS Provider Architecture & Gateway Adapters.
 *
 * Supports selectable providers via SMS_PROVIDER:
 *   - console  (ConsoleSmsProvider: logs to console, never leaks OTP in production)
 *   - fast2sms (Fast2SmsProvider: Indian DLT / Quick SMS gateway)
 *   - msg91    (Msg91Provider: MSG91 enterprise DLT gateway)
 *   - twilio   (TwilioProvider: global SMS gateway)
 */
import { env } from "./env";

export interface SmsProvider {
  readonly name: string;
  sendOtp(phone: string, code: string): Promise<boolean>;
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const isProd = env().NODE_ENV === "production";
    if (isProd) {
      const masked = phone.length > 4 ? `+91******${phone.slice(-4)}` : "+91******";
      console.info(`[sms:console] OTP dispatched to ${masked} (production mode - code withheld from logs)`);
    } else {
      console.info(`[sms:console] ${phone} → ${code} (dev mode)`);
    }
    return true;
  }
}

export class Fast2SmsProvider implements SmsProvider {
  readonly name = "fast2sms";

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const apiKey = env().FAST2SMS_API_KEY;
    if (!apiKey) {
      throw new Error("Fast2SMS is selected as SMS_PROVIDER, but FAST2SMS_API_KEY is not configured.");
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const body = {
      route: "otp",
      variables_values: code,
      numbers: cleanPhone,
    };

    try {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        console.error(`[sms:fast2sms] HTTP ${res.status}: ${await res.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[sms:fast2sms] Delivery failure:", err);
      return false;
    }
  }
}

export class Msg91Provider implements SmsProvider {
  readonly name = "msg91";

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const authKey = env().MSG91_AUTH_KEY;
    const templateId = env().MSG91_TEMPLATE_ID;
    if (!authKey || !templateId) {
      throw new Error("MSG91 is selected as SMS_PROVIDER, but MSG91_AUTH_KEY or MSG91_TEMPLATE_ID is not configured.");
    }

    const cleanPhone = "91" + phone.replace(/\D/g, "").slice(-10);
    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", templateId);
    url.searchParams.set("mobile", cleanPhone);
    url.searchParams.set("otp", code);

    try {
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      return res.ok;
    } catch (err) {
      console.error("[sms:msg91] Delivery failure:", err);
      return false;
    }
  }
}

export class TwilioProvider implements SmsProvider {
  readonly name = "twilio";

  async sendOtp(phone: string, code: string): Promise<boolean> {
    const sid = env().TWILIO_ACCOUNT_SID;
    const token = env().TWILIO_AUTH_TOKEN;
    const from = env().TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) {
      throw new Error("Twilio is selected as SMS_PROVIDER, but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER is missing.");
    }

    const cleanPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "").slice(-10)}`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();
    params.set("From", from);
    params.set("To", cleanPhone);
    params.set("Body", `Your KaamSetu verification code is ${code}. Valid for 5 minutes.`);

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      return res.ok;
    } catch (err) {
      console.error("[sms:twilio] Delivery failure:", err);
      return false;
    }
  }
}

let activeProvider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (activeProvider) return activeProvider;

  const providerType = env().SMS_PROVIDER;
  switch (providerType) {
    case "fast2sms":
      activeProvider = new Fast2SmsProvider();
      break;
    case "msg91":
      activeProvider = new Msg91Provider();
      break;
    case "twilio":
      activeProvider = new TwilioProvider();
      break;
    case "console":
    default:
      activeProvider = new ConsoleSmsProvider();
      break;
  }
  return activeProvider;
}

