# Garrison Market — Roadmap

## Current maintenance
- [x] Update public Contact section WhatsApp link and displayed number to +234 906 785 9200.
- [x] Update public Contact section phone link and displayed number to +234 906 785 9200.
- [x] Keep JSON-LD customer-support telephone and WhatsApp `sameAs` metadata aligned with the visible contact details.
- [x] Build and deploy the updated `main` commit to Vercel production.
- [x] Confirm Vercel reports the production deployment as `READY` and both `gmstock.co` and `www.gmstock.co` aliases map to it.
- [ ] Verify the live page's rendered contact text and links from an external browser.

## Deployment recovery notes
The automatic Git-triggered deployments were blocked by Vercel Hobby-team collaboration checks. Vercel's GitHub bot reported that GitHub user `@MrDan001` was not recognized as a member of the `mifi-tech` Hobby team and advised connecting the GitHub account to the Vercel account (or using a Pro team for multi-member collaboration).

To get the current release live without changing the plan, the merged `main` commit was deployed directly through the Vercel API using the project's existing GitHub repository connection. That production deployment completed successfully. Future automatic Git-triggered deployments may still be blocked until the GitHub identity is correctly connected under Vercel account authentication.

## Release verification
- [x] WhatsApp URL in source: `https://wa.me/2349067859200`.
- [x] Phone URL in source: `tel:+2349067859200`.
- [x] Structured metadata telephone: `+234-906-785-9200`.
- [x] Structured metadata WhatsApp `sameAs`: `https://wa.me/2349067859200`.
- [x] Production alias `gmstock.co` points to deployment `dpl_5PJwL3dw9Jx1Px1Rstyq3Ctr5oYw`.
- [x] Production alias `www.gmstock.co` points to the same deployment.
