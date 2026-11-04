import QRCode from "qrcode";
import { requireStaff } from "@/lib/admin/guard";
import { getSite } from "@/lib/settings";
import { otpauthUrl } from "@/lib/totp";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/admin/ui";
import { ConfirmSetupForm, ManageTwoStep } from "@/components/admin/TwoStepSetup";
import { cancelSetup, startSetup } from "./actions";

export const metadata = { title: "Two-step login" };

export default async function Security() {
  const user = await requireStaff();
  const me = (await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, totpSecret: true, totpPending: true, totpRecovery: true } }))!;
  const site = await getSite();
  const left = ((me.totpRecovery as string[] | null) ?? []).length;
  const qr = me.totpPending ? await QRCode.toDataURL(otpauthUrl(me.totpPending, me.email, site.name), { margin: 1, width: 220 }) : null;
  return (<>
    <PageHeader title="Two-step login" subtitle="Your password plus a code from your phone, so a stolen password alone can't open the admin." />
    <div className="grid max-w-3xl gap-6">
      {me.totpSecret ? (
        <Card title="Two-step login is on">
          <p className="mb-6 text-sm text-ink-soft">Each time you log in you'll enter a code from your authenticator app. Recovery codes left: <strong>{left}</strong>{left <= 2 && " (make new ones below)"}.</p>
          <ManageTwoStep />
        </Card>
      ) : me.totpPending && qr ? (
        <Card title="Set up your authenticator app">
          <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>Install an authenticator app on your phone: Google Authenticator, Microsoft Authenticator or similar.</li>
            <li>In the app, add an account and scan this QR code.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <div className="mb-5 flex flex-wrap items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-form border border-line" />
            <div className="text-sm"><p className="text-ink-soft">Can't scan? Enter this key in the app:</p>
              <p className="mt-1 break-all font-mono text-base tracking-wider">{me.totpPending.replace(/(.{4})/g, "$1 ").trim()}</p></div>
          </div>
          <ConfirmSetupForm />
          <form action={cancelSetup} className="mt-4"><button className="text-sm text-ink-muted hover:text-ink">Cancel setup</button></form>
        </Card>
      ) : (
        <Card title="Two-step login is off">
          <p className="mb-4 text-sm text-ink-soft">Turn it on to protect the orders, customers and prices this account can change. It takes about a minute and needs an authenticator app on your phone.</p>
          <form action={startSetup}><button className="btn-primary">Set up two-step login</button></form>
        </Card>
      )}
    </div>
  </>);
}
