// FILE: apps/frontend/app/register/RegisterForm.tsx
//
// The actual owner-registration form — moved out of page.tsx unchanged
// (Stage 2 of the 100-day waitlist gate) so page.tsx can be a Server
// Component that checks the registration gate BEFORE this client
// bundle ever ships to the browser. No logic in this file changed.

"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { Store, Phone, MapPin, Upload, Camera, AlertCircle, Mail, Lock, Eye, EyeOff, Loader2, ChevronRight, ShoppingBag, Building2, Tag } from "lucide-react";
import { registerOwnerAction } from "@/lib/auth.actions";

const NIGERIAN_LOCATIONS: Record<string, string[]> = {
  "Abia": ["Aba North", "Aba South", "Arochukwu", "Bende", "Ikwuano", "Isiala Ngwa North", "Isiala Ngwa South", "Isuikwuato", "Obi Ngwa", "Ohafia", "Osisioma", "Ugwunagbo", "Ukwa East", "Ukwa West", "Umuahia North", "Umuahia South", "Umu Nneochi"],
  "Adamawa": ["Demsa", "Fufure", "Ganye", "Gayuk", "Gombi", "Girei", "Hong", "Jada", "Lamurde", "Madagali", "Maiha", "Mayo Belwa", "Michika", "Mubi North", "Mubi South", "Numan", "Shelleng", "Song", "Toungo", "Yola North", "Yola South"],
  "Akwa Ibom": ["Abak", "Eastern Obolo", "Eket", "Esit Eket", "Essien Udim", "Etim Ekpo", "Etinan", "Ibeno", "Ibesikpo Asutan", "Ibiono-Ibom", "Ika", "Ikono", "Ikot Abasi", "Ikot Ekpene", "Ini", "Itu", "Mbo", "Mkpat-Enin", "Nsit-Atai", "Nsit-Ibom", "Nsit-Ubium", "Obot Akara", "Okobo", "Onna", "Oron", "Oruk Anam", "Udung-Uko", "Ukanafun", "Uruan", "Urue-Offong/Oruko", "Uyo"],
  "Anambra": ["Aguata", "Anambra East", "Anambra West", "Anaocha", "Awka North", "Awka South", "Ayamelum", "Dunukofia", "Ekwusigo", "Idemili North", "Idemili South", "Ihiala", "Njikoka", "Nnewi North", "Nnewi South", "Ogbaru", "Onitsha North", "Onitsha South", "Orumba North", "Orumba South", "Oyi"],
  "Bauchi": ["Alkaleri", "Bauchi", "Bogoro", "Dambam", "Darazo", "Dass", "Gamawa", "Ganjuwa", "Giade", "Itas/Gadau", "Jama'are", "Katagum", "Kirfi", "Misau", "Ningi", "Shira", "Tafawa Balewa", "Toro", "Warji", "Zaki"],
  "Bayelsa": ["Brass", "Ekeremor", "Kolokuma/Opokuma", "Nembe", "Ogbia", "Sagbama", "Southern Ijaw", "Yenagoa"],
  "Benue": ["Agatu", "Apa", "Ado", "Buruku", "Gboko", "Guma", "Gwer East", "Gwer West", "Katsina-Ala", "Konshisha", "Kwande", "Logo", "Makurdi", "Obi", "Ogbadibo", "Ohimini", "Oju", "Okpokwu", "Otukpo", "Tarka", "Ukum", "Ushongo", "Vandeikya"],
  "Borno": ["Abadam", "Askira/Uba", "Bama", "Bayo", "Biu", "Chibok", "Damboa", "Dikwa", "Gubio", "Guzamala", "Gwoza", "Hawul", "Jere", "Kaga", "Kala/Balge", "Konduga", "Kukawa", "Kwaya Kusar", "Mafa", "Magumeri", "Maiduguri", "Marte", "Mobbar", "Monguno", "Ngala", "Nganzai", "Shani"],
  "Cross River": ["Abi", "Akamkpa", "Akpabuyo", "Bakassi", "Bekwarra", "Biase", "Boki", "Calabar Municipal", "Calabar South", "Etung", "Ikom", "Obanliku", "Obubra", "Obudu", "Odukpani", "Ogoja", "Yakuur", "Yala"],
  "Delta": ["Aniocha North", "Aniocha South", "Bomadi", "Burutu", "Ethiope East", "Ethiope West", "Ika North East", "Ika South", "Isoko North", "Isoko South", "Ndokwa East", "Ndokwa West", "Okpe", "Oshimili North", "Oshimili South", "Patani", "Sapele", "Udu", "Ughelli North", "Ughelli South", "Ukwuani", "Uvwie", "Warri North", "Warri South", "Warri South West"],
  "Ebonyi": ["Abakaliki", "Afikpo North", "Afikpo South", "Ebonyi", "Ezza North", "Ezza South", "Ikwo", "Ishielu", "Izzi", "Ohaozara", "Ohaukwu", "Onicha"],
  "Edo": ["Akoko-Edo", "Egor", "Esan Central", "Esan North-East", "Esan South-East", "Esan West", "Etsako Central", "Etsako East", "Etsako West", "Igueben", "Ikpoba Okha", "Orhionmwon", "Oredo", "Ovia North-East", "Ovia South-West", "Owan East", "Owan West", "Uhunmwonde"],
  "Ekiti": ["Ado Ekiti", "Efon", "Ekiti East", "Ekiti South-West", "Ekiti West", "Emure", "Gbonyin", "Ido Osi", "Ijero", "Ikere", "Ikole", "Ilejemeje", "Irepodun/Ifelodun", "Ise/Orun", "Moba", "Oye"],
  "Enugu": ["Aninri", "Awgu", "Enugu East", "Enugu North", "Enugu South", "Ezeagu", "Igbo Etiti", "Igbo Eze North", "Igbo Eze South", "Isi Uzo", "Nkanu East", "Nkanu West", "Nsukka", "Oji River", "Udenu", "Udi", "Uzo Uwani"],
  "FCT (Abuja)": ["Abaji", "AMAC (Municipal)", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
  "Gombe": ["Akko", "Balanga", "Billiri", "Dukku", "Funakaye", "Gombe", "Kaltungo", "Kwami", "Nafada", "Shongom", "Yamaltu/Deba"],
  "Imo": ["Aboh Mbaise", "Ahiazu Mbaise", "Ehime Mbano", "Ezinihitte", "Ideato North", "Ideato South", "Ihitte/Uboma", "Ikeduru", "Isiala Mbano", "Isu", "Mbaitoli", "Ngor Okpala", "Njaba", "Nkwerre", "Nwangele", "Obowo", "Oguta", "Ohaji/Egbema", "Okigwe", "Orlu", "Orsu", "Oru East", "Oru West", "Owerri Municipal", "Owerri North", "Owerri South"],
  "Jigawa": ["Auyo", "Babura", "Biriniwa", "Birnin Kudu", "Buji", "Dutse", "Gagarawa", "Garki", "Gumel", "Guri", "Gwaram", "Gwiwa", "Hadejia", "Jahun", "Kafin Hausa", "Kaugama", "Kazaure", "Kiri Kasama", "Kiyawa", "Maigatari", "Malam Madori", "Miga", "Ringim", "Roni", "Sule Tankarkar", "Taura", "Yankwashi"],
  "Kaduna": ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema'a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kaura", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zangon Kataf", "Zaria"],
  "Kano": ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo", "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa", "Tudun Wada", "Ungogo", "Warawa", "Wudil"],
  "Katsina": ["Bakori", "Batagarawa", "Batsari", "Baure", "Bindawa", "Charanchi", "Dandume", "Danja", "Dan Musa", "Daura", "Dutsin Ma", "Faskari", "Funtua", "Ingawa", "Jibia", "Kafur", "Kaita", "Kankara", "Kankia", "Katsina", "Kurfi", "Kusada", "Mai'Adua", "Malumfashi", "Mani", "Mashi", "Matazu", "Musawa", "Rimi", "Sabuwa", "Safana", "Sandamu", "Zango"],
  "Kebbi": ["Aleiro", "Arewa Dandi", "Argungu", "Augie", "Bagudo", "Birnin Kebbi", "Bunza", "Dandi", "Fakai", "Gwandu", "Jega", "Kalgo", "Koko/Besse", "Maiyama", "Ngaski", "Sakaba", "Shanga", "Suru", "Wasagu/Danko", "Yauri", "Zuru"],
  "Kogi": ["Adavi", "Ajaokuta", "Ankpa", "Bassa", "Dekina", "Ibaji", "Idah", "Igalamela Odolu", "Ijumu", "Kabba/Bunu", "Kogi", "Lokoja", "Mopa Muro", "Ofu", "Ogori/Magongo", "Okehi", "Okene", "Olamaboro", "Omala", "Yagba East", "Yagba West"],
  "Kwara": ["Asa", "Baruten", "Edu", "Ekiti", "Ifelodun", "Ilorin East", "Ilorin South", "Ilorin West", "Irepodun", "Isin", "Kaiama", "Moro", "Offa", "Oke Ero", "Oyun", "Pategi"],
  "Lagos": ["Agege", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry", "Epe", "Eti Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere"],
  "Nasarawa": ["Akwanga", "Awe", "Doma", "Karu", "Keana", "Keffi", "Kokona", "Lafia", "Nasarawa", "Nasarawa Egon", "Obi", "Toto", "Wamba"],
  "Niger": ["Agaie", "Agwara", "Bida", "Borgu", "Bosso", "Chanchaga", "Edati", "Gbako", "Gurara", "Katcha", "Kontagora", "Lapai", "Lavun", "Magama", "Mariga", "Mashegu", "Mokwa", "Moya", "Paikoro", "Rafi", "Rijau", "Shiroro", "Suleja", "Tafa", "Wushishi"],
  "Ogun": ["Abeokuta North", "Abeokuta South", "Ado-Odo/Ota", "Egbado North", "Egbado South", "Ewekoro", "Ifo", "Ijebu East", "Ijebu North", "Ijebu North East", "Ijebu Ode", "Ikenne", "Imeko Afon", "Ipokia", "Obafemi Owode", "Odeda", "Odogbolu", "Ogun Waterside", "Remo North", "Shagamu"],
  "Ondo": ["Akoko North-East", "Akoko North-West", "Akoko South-West", "Akoko South-East", "Akure North", "Akure South", "Ese Odo", "Idanre", "Ifedore", "Ilaje", "Ile Oluji/Okeigbo", "Irele", "Odigbo", "Okitipupa", "Ondo East", "Ondo West", "Ose", "Owo"],
  "Osun": ["Atakunmosa East", "Atakunmosa West", "Aiyedaade", "Aiyedire", "Boluwaduro", "Boripe", "Ede North", "Ede South", "Ife Central", "Ife East", "Ife North", "Ife South", "Egbedore", "Ila", "Ilesa North", "Ilesa South", "Irepodun", "Irewole", "Isokan", "Iwo", "Obokun", "Odo Otin", "Ola Oluwa", "Olorunda", "Oriade", "Orolu", "Osogbo"],
  "Oyo": ["Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North-East", "Ibadan North-West", "Ibadan South-East", "Ibadan South-West", "Ibarapa Central", "Ibarapa East", "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu", "Ogbomosho North", "Ogbomosho South", "Ogo Oluwa", "Olorunsogo", "Oluyole", "Ona Ara", "Orelope", "Ori Ire", "Oyo East", "Oyo West", "Saki East", "Saki West", "Surulere"],
  "Plateau": ["Barkin Ladi", "Bassa", "Bokkos", "Jos East", "Jos North", "Jos South", "Kanam", "Kanke", "Langtang North", "Langtang South", "Mangu", "Mikang", "Pankshin", "Qua'an Pan", "Riyom", "Shendam", "Wase"],
  "Rivers": ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku Toru", "Andoni", "Asari-Toru", "Bonny", "Degema", "Eleme", "Emuoha", "Etche", "Ikwerre", "Oyigbo", "Khana", "Obio/Akpor", "Ogba/Egbema/Ndoni", "Ogu/Bolo", "Okrika", "Omuma", "Opobo/Nkoro", "Port Harcourt", "Tai"],
  "Sokoto": ["Binji", "Bodinga", "Dange Shuni", "Gada", "Goronyo", "Gudu", "Gwadabawa", "Illela", "Isa", "Kebbe", "Kware", "Rabah", "Sabon Birni", "Shagari", "Silame", "Sokoto North", "Sokoto South", "Tambuwal", "Tangaza", "Tureta", "Wamako", "Wurno", "Yabo"],
  "Taraba": ["Ardo Kola", "Bali", "Donga", "Gashaka", "Gassol", "Ibi", "Jalingo", "Karim Lamido", "Kurmi", "Lau", "Sardauna", "Takum", "Ussa", "Wukari", "Yorro", "Zing"],
  "Yobe": ["Bade", "Bursari", "Damaturu", "Fika", "Fune", "Geidam", "Gujba", "Gulani", "Jakusko", "Karasuwa", "Machina", "Nangere", "Nguru", "Potiskum", "Tarmuwa", "Yunusari", "Yusufari"],
  "Zamfara": ["Anka", "Bakura", "Birnin Magaji/Kiyaw", "Bukkuyum", "Bungudu", "Gummi", "Gusau", "Kaura Namoda", "Maradun", "Maru", "Shinkafi", "Talata Mafara", "Chafe", "Zurmi"]
};

export default function RegisterForm() {
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [products, setProducts] = useState("");
  const [shopAddress, setShopAddress] = useState(""); 
  const [selectedState, setSelectedState] = useState("");
  const [selectedLga, setSelectedLga] = useState("");
  const [referralCode, setReferralCode] = useState(""); // NEW: Added local state tracking for referral input
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // If the visitor arrived via an affiliate link (see
  // app/ref/[code]/route.ts), pre-fill and lock the Referral Code field
  // with their code so it's visibly confirmed — not editable, so it
  // can't be swapped out by mistake. Attribution itself doesn't depend
  // on this field either way: resolveAffiliateAttribution() in
  // affiliate.actions.ts reads the same cookie independently,
  // server-side, when the account is actually created.
  const [affiliateLocked, setAffiliateLocked] = useState(false);
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )gm_aff_ref=([^;]*)/);
    if (match) {
      const [code] = decodeURIComponent(match[1]).split(":");
      if (code) {
        setReferralCode(code);
        setAffiliateLocked(true);
      }
    }
  }, []);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const handleStateChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const stateValue = e.target.value;
    setSelectedState(stateValue);
    setSelectedLga("");
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG/JPEG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image is too large. Maximum size is 5MB.");
      return;
    }

    setErrorMessage("");
    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (!notificationConsent || !marketingConsent) {
      setErrorMessage("Please consent to both notifications and marketing emails to continue.");
      setIsSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();

      formData.append("email", email);
      formData.append("password", password);
      formData.append("fullName", ownerName);
      formData.append("storeName", storeName);
      formData.append("phoneNumber", `+234${phone}`);
      formData.append("productsSold", products);
      formData.append("shopAddress", shopAddress); 
      formData.append("shopState", selectedState);
      formData.append("shopCity", selectedLga);
      formData.append("referralCode", referralCode); // NEW: Append tracking identifier to standard request matrix

      if (imageFile) {
        const compressed = await compressImage(imageFile, { maxDimension: 800, quality: 0.82 });
        const blob = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/blob/register-upload",
        });
        formData.append("imageUrl", blob.url);
      }

      const result = await registerOwnerAction(formData);

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
      } else if (result?.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMessage("Registration sequence failed. Please verify connection credentials.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between" style={{ fontFamily: "var(--font-body)" }}>

      <header className="border-b border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
              <span className="text-[#0D1527] font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>G</span>
            </div>
            <span className="font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>GARRISON MARKET</span>
          </Link>
          <span className="text-xs uppercase tracking-widest text-[var(--text-primary)]/40" style={{ fontFamily: "var(--font-mono)" }}>Node Setup</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-[var(--bg-surface)] rounded-sm p-8 border border-[var(--border-subtle)]/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                REGISTER YOUR BUSINESS
              </h1>
              <p className="text-xs text-[var(--text-primary)]/50 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                System Architecture Access Point
              </p>
            </div>

            {errorMessage && (
              <div className="bg-[#E55345]/10 border border-[#E55345]/20 text-[#E55345] rounded-sm p-3 flex items-center gap-2 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Store / Verification Image
              </label>
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-app)] rounded-sm border border-[var(--border-subtle)]/10">
                <div className="relative h-16 w-16 bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)]/20 rounded-sm flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-[var(--text-primary)]/30" />
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)]/10 hover:border-[var(--border-subtle)]/30 cursor-pointer text-[var(--text-primary)] transition">
                    <Upload size={14} className="text-[#E55345]" />
                    <span>{imageFile ? "Change Image" : "Upload Photo"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                  <p className="text-[10px] text-[var(--text-primary)]/40 leading-normal">
                    JPEG or PNG format. Max file restriction: 5MB limit.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Store Name</label>
                <div className="relative">
                  <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input required type="text" placeholder="e.g. Garrison Outlets" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                         className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Owner Name</label>
                <input required type="text" placeholder="First & Last Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                       className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input required type="email" placeholder="owner@garrison.market" value={email} onChange={(e) => setEmail(e.target.value)}
                         className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-12 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Products / Services Description
              </label>
              <div className="relative">
                <ShoppingBag size={16} className="absolute left-3 top-3.5 text-[var(--text-primary)]/30" />
                <textarea
                  required
                  rows={3}
                  placeholder="What are you selling? (e.g. Designer Shoes, Wholesale Electronics, Organic Skincare...)"
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition resize-none leading-relaxed"
                />
              </div>
              <p className="text-[10px] text-[var(--text-primary)]/40">Briefly detail your core commodities or specializations so customers can query your node.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Shop Address
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                <input
                  required
                  type="text"
                  placeholder="Street address of your shop"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition"
                />
              </div>
            </div>

            {/* NEW: Referral Token Input Node Block */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Referral Code <span className="text-[var(--text-primary)]/30 lowercase font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Tag size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${affiliateLocked ? "text-[#1F6D4C]" : "text-[var(--text-primary)]/30"}`} />
                <input
                  type="text"
                  placeholder="e.g. GARRISON_STORE_9901"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  readOnly={affiliateLocked}
                  className={`w-full text-sm pl-10 pr-4 py-3 rounded-sm border transition tracking-wide uppercase focus:outline-none ${
                    affiliateLocked
                      ? "bg-[#E7F1EB] text-[#1F6D4C] border-[#1F6D4C]/30 font-bold cursor-default"
                      : "bg-[var(--bg-app)] text-[var(--text-primary)] border-[var(--border-subtle)]/10 focus:border-[#E55345]"
                  }`}
                />
              </div>
              <p className={`text-[10px] ${affiliateLocked ? "text-[#1F6D4C]" : "text-[var(--text-primary)]/40"}`}>
                {affiliateLocked
                  ? "Picked up automatically from your referral link."
                  : "Enter a peer invite token to participate in affiliate program allocations."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Phone Number</label>
              <div className="flex rounded-sm overflow-hidden border border-[var(--border-subtle)]/10 focus-within:border-[#E55345] transition">
                <div className="bg-[var(--bg-app)]/60 text-sm font-medium px-4 flex items-center gap-1.5 border-r border-[var(--border-subtle)]/10 text-[var(--text-primary)]/60" style={{ fontFamily: "var(--font-mono)" }}>
                  <Phone size={14} className="text-[var(--text-primary)]/30" />
                  <span>+234</span>
                </div>
                <input required type="tel" pattern="[0-9]{7,10}" placeholder="8031234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                       className="flex-1 bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 focus:outline-none" />
              </div>
              <p className="text-[10px] text-[var(--text-primary)]/40">Input local number configuration omitting initial zero line prefix.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>State</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30 pointer-events-none z-10" />
                  <select required value={selectedState} onChange={handleStateChange}
                          className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-9 pr-8 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] appearance-none cursor-pointer transition">
                    <option value="" disabled>Select State</option>
                    {Object.keys(NIGERIAN_LOCATIONS).map((state) => (
                      <option key={state} value={state} className="bg-[var(--bg-surface)]">{state}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-primary)]/30 text-xs">▼</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>LGA</label>
                <div className="relative">
                  <select required value={selectedLga} onChange={(e) => setSelectedLga(e.target.value)} disabled={!selectedState}
                          className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 pr-8 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition">
                    <option value="" disabled>Select LGA</option>
                    {selectedState && NIGERIAN_LOCATIONS[selectedState].map((lga) => (
                      <option key={lga} value={lga} className="bg-[var(--bg-surface)]">{lga}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-primary)]/30 text-xs">▼</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-[var(--bg-app)]/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]/50" style={{ fontFamily: "var(--font-mono)" }}>
                Communication Consent
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="notificationConsent"
                  checked={notificationConsent}
                  onChange={(e) => setNotificationConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span className="text-xs text-[var(--text-primary)]/75 leading-relaxed">
                  I consent to receive Garrison Market app notifications, including order alerts, account updates, and important service notices.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="marketingConsent"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="text-xs text-[var(--text-primary)]/75 leading-relaxed">
                  I consent to receive Garrison Market marketing emails, including product updates, tips, offers, and announcements. I can unsubscribe from marketing emails at any time.
                </span>
              </label>

              <p className="text-[10px] text-[var(--text-primary)]/40 leading-relaxed">
                Both consents are required before your account can be created.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !notificationConsent || !marketingConsent}
              className="group w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 py-4 font-semibold text-slate-50 dark:text-slate-950 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  Create Owner Account
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-[var(--text-primary)]/50">
                Already matching directory keys?{" "}
                <Link href="/login" className="text-[var(--text-primary)] underline hover:text-[#E55345] transition">Sign in here</Link>
              </p>
            </div>
          </form>

        </div>
      </main>

      <footer className="py-6 text-center text-[var(--text-primary)]/20 text-xs border-t border-[var(--border-subtle)]/5">
        &copy; {new Date().getFullYear()} Garrison Market Core // Identity Deployment Matrix
      </footer>
    </div>
  );
}