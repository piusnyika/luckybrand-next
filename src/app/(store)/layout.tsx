import Script from "next/script";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { CartProvider } from "@/components/store/CartProvider";
import { CartDrawer } from "@/components/store/CartDrawer";
import { MobileBottomBar } from "@/components/store/MobileBottomBar";
import { ChatBubble } from "@/components/store/ChatBubble";
import { assistantAvailable, getSite, salesContactsOf } from "@/lib/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  const contacts = salesContactsOf(site), ai = assistantAvailable(site);
  return (
    <CartProvider>
      <Header />
      <main className="min-h-[50vh]">{children}</main>
      <Footer />
      <CartDrawer freeShipping={{ threshold: site.freeShippingThreshold, message: site.freeShippingMessage, success: site.freeShippingSuccess }} />
      <MobileBottomBar />
      {site.chatEnabled && (ai || contacts.length > 0) && <ChatBubble contacts={contacts} storeName={site.name} assistant={ai ? { name: site.assistantName, greeting: site.assistantGreeting } : null} />}
      {site.gaMeasurementId && (<>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${site.gaMeasurementId}`} strategy="lazyOnload" />
        <Script id="ga" strategy="lazyOnload">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${site.gaMeasurementId}');`}</Script>
      </>)}
      {site.tawkPropertyId && site.tawkWidgetId && (
        <Script id="tawk" strategy="lazyOnload">{`var Tawk_API=Tawk_API||{};(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/${site.tawkPropertyId}/${site.tawkWidgetId}';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`}</Script>
      )}
    </CartProvider>
  );
}
