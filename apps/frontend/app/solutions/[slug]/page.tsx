import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const siteUrl = "https://gmstock.co";

const solutions = [
  {
    slug: "inventory-management-software",
    title: "Inventory Management Software for Growing Businesses",
    seoTitle: "Inventory Management Software for Businesses",
    description: "Track products, quantities, prices and low-stock levels with Garrison Market. Keep inventory, sales, staff activity and business records in one workspace.",
    intro: "Know what your business has in stock, understand what is moving, and give your team one organized place to keep inventory records up to date.",
    detail: "Garrison Market brings product records, stock quantities, sales activity and team workflows together. Owners can review inventory and business activity while staff use their own accounts for the work assigned to them.",
    benefits: [
      ["Organize product records", "Keep product names, categories, quantities and pricing together instead of spreading stock information across notebooks and disconnected spreadsheets."],
      ["Watch stock levels", "Set low-stock thresholds and review items that need attention before they run out."],
      ["Connect stock with sales", "Keep sales activity in the same workspace as inventory so owners can review what has happened."],
      ["Keep your team accountable", "Give staff individual accounts and review activity without sharing the owner's login."],
      ["Review the wider business", "Bring expenses, customer records, invoices and reports into the same operating picture."]
    ],
    useCases: ["Retail and specialty stores", "Wholesale and distribution businesses", "Food and beverage retailers", "Beauty and personal-care businesses", "Businesses operating across multiple locations"],
    faqs: [
      ["What is inventory management software?", "Inventory management software helps a business organize product records, quantities and stock activity so owners and teams can keep track of what is available and what needs attention."],
      ["Can staff update inventory too?", "Yes. Garrison Market supports individual staff accounts, with access managed by the business owner."],
      ["Can I manage more than one store?", "Yes. Multiple-location management is available, with the number of locations depending on the selected plan."]
    ]
  },
  {
    slug: "stock-management-software",
    title: "Stock Management Software to Keep Business Stock Organized",
    seoTitle: "Stock Management Software | Garrison Market",
    description: "Manage stock quantities, product details, sales and low-stock thresholds in one workspace. Garrison Market helps business owners and staff stay on top of stock.",
    intro: "Replace scattered stock notes with a clearer way to record products, monitor quantities and review stock activity across your business.",
    detail: "Garrison Market connects stock records with day-to-day sales and staff activity. Owners can see the business picture while team members work through their own accounts and assigned responsibilities.",
    benefits: [
      ["Maintain a central stock list", "Keep product details, categories, quantities and prices organized in one place."],
      ["Identify items to restock", "Use low-stock thresholds to highlight products that need attention."],
      ["Keep sales and stock connected", "Review sales activity alongside inventory records rather than switching between separate tools."],
      ["Track team activity", "Give each staff member an individual login and review business activity by team."],
      ["Keep supporting records together", "Manage expenses, customers, invoices and reports alongside stock operations."]
    ],
    useCases: ["Shops and retail counters", "Wholesale businesses", "Food and beverage retailers", "Electronics and accessories stores", "Small businesses with stock to monitor"],
    faqs: [
      ["Is stock management different from inventory management?", "The terms are often used interchangeably. Stock management usually focuses on the quantities and movement of products a business holds."],
      ["Can I set low-stock levels?", "Garrison Market supports low-stock thresholds to help identify products that need restocking."],
      ["Can I use it with my employees?", "Yes. Owners can create staff accounts and manage access for their team."]
    ]
  },
  {
    slug: "small-business-management-software",
    title: "Business Management Software for Small Businesses",
    seoTitle: "Small Business Management Software | Garrison Market",
    description: "Manage inventory, sales, staff, expenses, customers, invoices and reports with Garrison Market, a connected business management workspace for owners and teams.",
    intro: "Running a small business should not mean keeping stock in one notebook, expenses in another and staff updates in private messages.",
    detail: "Garrison Market gives owners and teams a shared workspace for the operational records that keep a business moving. Start with your inventory, bring in your staff, and review sales, expenses and customer records together.",
    benefits: [
      ["Bring everyday operations together", "Keep inventory, sales, expenses, customer records, invoices and reports in one workspace."],
      ["Give employees their own access", "Create individual staff accounts and manage what team members can access."],
      ["Understand business activity", "Review sales history, expenses and reports to get a clearer view of daily operations."],
      ["Keep customer records organized", "Maintain customer profiles, balances and part-payment history where supported by your plan."],
      ["Grow into more locations", "Manage multiple business locations with limits based on your selected plan."]
    ],
    useCases: ["Independent shops", "Growing retail businesses", "Wholesale and distribution teams", "Food and beverage retailers", "Owner-managed businesses with employees"],
    faqs: [
      ["What can a small business manage with Garrison Market?", "Garrison Market supports inventory, sales, staff, expenses, customer records, invoices and reports in one workspace."],
      ["Can I start without a large team?", "Yes. The platform is designed for owners and teams, and available staff and product limits depend on the selected plan."],
      ["Does it support multiple locations?", "Yes. Multiple-location management is available on plans that include it."]
    ]
  },
  {
    slug: "retail-inventory-management",
    title: "Retail Inventory Management Software for Shops and Stores",
    seoTitle: "Retail Inventory Management Software | Garrison Market",
    description: "Organize retail products, track stock quantities, review sales and manage staff with Garrison Market. Keep store operations and business records connected.",
    intro: "Whether you run a neighborhood shop or a growing retail business, clear product and stock records help you make better day-to-day decisions.",
    detail: "Garrison Market helps retail owners organize products and quantities, review sales activity, manage staff accounts and keep expenses and customer records close to inventory operations.",
    benefits: [
      ["Organize products and pricing", "Keep product details, categories, quantities and prices in a central inventory."],
      ["Stay aware of low stock", "Set low-stock thresholds and identify products that need attention."],
      ["Review sales activity", "Keep order and sales records alongside inventory information."],
      ["Manage store staff", "Create individual staff accounts and review team activity."],
      ["Keep business records connected", "Record expenses, manage customer information and review reports from the same workspace."]
    ],
    useCases: ["General merchandise shops", "Clothing and fashion stores", "Electronics and accessories retailers", "Beauty and personal-care retailers", "Specialty and convenience stores"],
    faqs: [
      ["Is Garrison Market suitable for a small retail shop?", "Garrison Market is designed for business owners and teams that need to organize products, stock, sales and daily operations."],
      ["Can I manage more than one retail location?", "Yes. Multiple-location support is available, with location limits depending on your plan."],
      ["Can my sales staff have separate accounts?", "Yes. Owners can create individual staff accounts and manage team access."]
    ]
  },
  {
    slug: "multi-location-inventory-management",
    title: "Multi-Location Inventory and Business Management",
    seoTitle: "Multi-Location Inventory Management Software",
    description: "Keep an overview of inventory and business activity across multiple stores with Garrison Market. Manage locations, staff, sales, expenses and reports in one workspace.",
    intro: "When a business operates from more than one location, owners need a consistent way to review stock and understand what is happening across the operation.",
    detail: "Garrison Market supports businesses managing multiple locations. Owners can organize their business workspace, bring staff into the system and review inventory and operational records across the locations included in their plan.",
    benefits: [
      ["Keep locations under one business", "Manage supported stores and locations from a connected owner workspace."],
      ["Organize inventory records", "Maintain product details, quantities and pricing in the business inventory."],
      ["Give each team member access", "Use individual staff accounts rather than sharing owner credentials."],
      ["Review sales and expenses", "Keep operational activity and spending records available for business review."],
      ["Choose a plan that fits", "The number of locations, staff logins and products depends on the selected subscription plan."]
    ],
    useCases: ["Retail groups with multiple stores", "Growing owner-operated businesses", "Wholesale and distribution businesses", "Businesses with separate branches", "Teams that need a shared operational overview"],
    faqs: [
      ["Can Garrison Market manage multiple stores?", "Yes. Multiple-location management is supported, with the number of locations depending on the selected plan."],
      ["Do all staff need the owner's login?", "No. Staff can use individual accounts created and managed by the business owner."],
      ["Are all locations included in every plan?", "No. Location limits vary by subscription plan."]
    ]
  },
  {
    slug: "sales-staff-expense-management",
    title: "Sales, Staff and Expense Management in One Workspace",
    seoTitle: "Sales, Staff and Expense Management Software",
    description: "Connect sales records, team activity, operating expenses, customer records and business reports with Garrison Market.",
    intro: "Sales numbers alone do not tell the whole story. Owners also need to understand who handled the work, what the business spent and what customers still owe.",
    detail: "Garrison Market brings important operating records together so owners can review sales, manage staff accounts, record expenses, maintain customer information and check business reports without jumping between disconnected tools.",
    benefits: [
      ["Review sales activity", "Keep orders and sales history in the same workspace as inventory."],
      ["Manage staff access", "Create individual accounts and review staff activity and submitted reports."],
      ["Record operating expenses", "Maintain an organized history of business spending alongside sales and stock activity."],
      ["Maintain customer records", "Keep customer profiles, balances and part-payment history where supported by your plan."],
      ["Use reports to review operations", "Bring business information together for clearer day-to-day oversight."]
    ],
    useCases: ["Owner-managed shops", "Retail teams", "Wholesale businesses", "Businesses with multiple employees", "Growing businesses that need clearer operational records"],
    faqs: [
      ["Can I manage sales and expenses together?", "Yes. Garrison Market supports sales activity and operating expense records in the same business workspace."],
      ["Can staff submit reports?", "Staff reporting and activity review are among the platform's team-management capabilities."],
      ["Can I manage customer balances?", "Customer balances and part-payment history are available according to the features included in your plan."]
    ]
  }
] as const;

type Solution = (typeof solutions)[number];

export function generateStaticParams() {
  return solutions.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutions.find((item) => item.slug === slug);
  if (!solution) return {};
  const url = `${siteUrl}/solutions/${solution.slug}`;
  return {
    title: solution.seoTitle,
    description: solution.description,
    alternates: { canonical: url },
    keywords: [solution.title, "Garrison Market", "business software", "inventory software"],
    openGraph: {
      type: "website",
      url,
      siteName: "Garrison Market",
      title: solution.seoTitle,
      description: solution.description,
    },
    twitter: {
      card: "summary",
      title: solution.seoTitle,
      description: solution.description,
    },
  };
}

function jsonLd(solution: Solution) {
  const url = `${siteUrl}/solutions/${solution.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Garrison Market",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description: solution.description,
      featureList: ["Inventory and stock tracking", "Sales records", "Staff accounts and activity", "Expense tracking", "Customer records", "Invoices and business reports", "Multiple business locations on supported plans"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Solutions", item: `${siteUrl}/solutions` },
        { "@type": "ListItem", position: 3, name: solution.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: solution.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = solutions.find((item) => item.slug === slug);
  if (!solution) notFound();

  const related = solutions.filter((item) => item.slug !== slug).slice(0, 4);
  const structuredData = JSON.stringify(jsonLd(solution)).replace(/</g, "\\u003c");

  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <header className="border-b border-[var(--border-subtle)]">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="font-black tracking-tight">GARRISON MARKET</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/solutions" className="hidden sm:inline hover:underline">All solutions</Link>
            <Link href="/login" className="hover:underline">Sign in</Link>
            <Link href="/waitlist" className="rounded-md bg-[#E55345] px-4 py-2 font-bold text-white">Get started</Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        <nav aria-label="Breadcrumb" className="py-6 text-sm text-[var(--text-secondary)]">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/solutions" className="hover:underline">Solutions</Link>
          <span className="mx-2">/</span>
          <span aria-current="page">{solution.title}</span>
        </nav>

        <section className="pb-16 pt-8 sm:pb-20 sm:pt-12">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#E55345]">Garrison Market solutions</p>
          <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{solution.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">{solution.intro}</p>
          <p className="mt-4 max-w-3xl leading-7 text-[var(--text-secondary)]">{solution.detail}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/waitlist" className="rounded-md bg-[#E55345] px-6 py-3 font-bold text-white hover:opacity-90">Join the waitlist</Link>
            <Link href="/" className="rounded-md border border-[var(--border-subtle)] px-6 py-3 font-semibold hover:border-[#E55345]">Explore Garrison Market</Link>
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">What you can manage with Garrison Market</h2>
          <div className="mt-8 grid gap-7 sm:grid-cols-2">
            {solution.benefits.map(([heading, body]) => (
              <article key={heading} className="border-l-2 border-[#E55345] pl-5">
                <h3 className="text-lg font-bold">{heading}</h3>
                <p className="mt-2 leading-7 text-[var(--text-secondary)]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Businesses this workspace can support</h2>
          <p className="mt-3 max-w-3xl leading-7 text-[var(--text-secondary)]">Garrison Market is built around everyday inventory and business operations. The right plan depends on your products, team size and number of locations.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {solution.useCases.map((item) => <li key={item} className="rounded-lg border border-[var(--border-subtle)] p-4">{item}</li>)}
          </ul>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-6 divide-y divide-[var(--border-subtle)]">
            {solution.faqs.map(([question, answer]) => (
              <details key={question} className="py-5">
                <summary className="cursor-pointer font-semibold">{question}</summary>
                <p className="mt-3 max-w-3xl leading-7 text-[var(--text-secondary)]">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-14">
          <h2 className="text-2xl font-bold">Explore more Garrison Market solutions</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link key={item.slug} href={`/solutions/${item.slug}`} className="rounded-lg border border-[var(--border-subtle)] p-4 font-semibold hover:border-[#E55345]">
                {item.title} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="border-t border-[var(--border-subtle)] py-8 text-sm text-[var(--text-secondary)]">
          <div className="flex flex-wrap gap-5">
            <Link href="/" className="hover:underline">Home</Link>
            <Link href="/security" className="hover:underline">Security</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} Garrison Market. Inventory and business management for owners and teams.</p>
        </footer>
      </div>
    </main>
  );
}
