/** Optional: push subscribers to Mailchimp when MAILCHIMP_API_KEY + MAILCHIMP_LIST_ID are set. */
export async function addToMailchimp(email: string) {
  const key = process.env.MAILCHIMP_API_KEY, list = process.env.MAILCHIMP_LIST_ID;
  if (!key || !list) return;
  const dc = key.split("-")[1];
  await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${list}/members`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from("any:" + key).toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify({ email_address: email, status: "subscribed" }),
  });
}
