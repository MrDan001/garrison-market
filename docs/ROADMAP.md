# Garrison Market — Roadmap

## Current maintenance
- [x] Update public Contact section WhatsApp link and displayed number to +234 906 785 9200.
- [x] Update public Contact section phone link and displayed number to +234 906 785 9200.
- [x] Keep JSON-LD customer-support telephone and WhatsApp `sameAs` metadata aligned with the visible contact details.
- [ ] Resolve the current Vercel production deployment block for project `garrison-market-u5a8`.
- [ ] Confirm a fresh production deployment reaches `READY` and the production domain serves the updated contact details.

## Deployment investigation notes
The latest inspected production deployment was marked `BLOCKED` before build events were emitted. Vercel returned a team-configuration troubleshooting link, rather than a Next.js compilation error. Investigate the Vercel project/team collaboration or Git deployment authorization configuration before attempting source-level build fixes.

## Release verification
- [ ] Verify `https://gmstock.co` displays WhatsApp +234 906 785 9200.
- [ ] Verify the WhatsApp link opens `https://wa.me/2349067859200`.
- [ ] Verify the phone link uses `tel:+2349067859200`.
- [ ] Verify structured metadata uses `+234-906-785-9200`.
