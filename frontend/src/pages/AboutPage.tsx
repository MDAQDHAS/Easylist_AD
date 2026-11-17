import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Sparkles,
  CheckCircle2,
  Cpu,
  Layers,
  ShieldCheck,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { ROUTES } from '../routes/paths';
import { DashboardHeader } from '../components/layout/DashboardHeader';

interface TeamMember {
  name: string;
  role: string;
  description: string;
  image?: string;
  initials: string;
  accentBg: string;
  accentColor: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Gokulraj.V',
    role: 'Co-Founder & CEO',
    description: 'Leading strategic vision, product roadmaps, and business partnerships across retail digitization.',
    image: '/images/team/gokulraj.jpeg',
    initials: 'GV',
    accentBg: 'bg-indigo-50',
    accentColor: 'text-[#5046F2]',
  },
  {
    name: 'Mohamed Aqdahs.U',
    role: 'Co-Founder & CTO',
    description: 'Spearheading core AI architecture, full-stack systems engineering, and OCR reliability pipelines.',
    image: '/images/team/mohamed_aqdas.jpg',
    initials: 'MA',
    accentBg: 'bg-blue-50',
    accentColor: 'text-blue-600',
  },
  {
    name: 'Jeeva.M',
    role: 'Co-Founder & CFO',
    description: 'Guiding corporate financial planning, resource allocation, and sustainable operational growth.',
    image: '/images/team/jeeva_m.png',
    initials: 'JM',
    accentBg: 'bg-emerald-50',
    accentColor: 'text-emerald-600',
  },
  {
    name: 'Karthikeyan.M',
    role: 'Co-Founder & CMO',
    description: 'Directing market expansion, brand communications, and direct merchant outreach campaigns.',
    image: '/images/team/karthikeyan_m.png',
    initials: 'KM',
    accentBg: 'bg-purple-50',
    accentColor: 'text-purple-600',
  },
  {
    name: 'Sathishkumar.S',
    role: 'Co-Founder & COO',
    description: 'Managing day-to-day operations, supply-chain partner onboarding, and customer success fulfillment.',
    image: '/images/team/sathishkumar_s.png',
    initials: 'SS',
    accentBg: 'bg-amber-50',
    accentColor: 'text-amber-600',
  },
];

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (name: string) => {
    setImageErrors((prev) => ({ ...prev, [name]: true }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans flex flex-col selection:bg-[#5046F2] selection:text-white">
      {/* 1. TOP FLOATING NAVIGATION BAR */}
      <div className="relative z-50">
        <DashboardHeader
          variant="dashboard"
          onLogout={() => navigate(ROUTES.LOGIN)}
        />
      </div>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#111C35] to-[#1E293B] text-white py-16 sm:py-20 px-4 sm:px-6">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#5046F2_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200 mb-6 shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-[#5046F2]" />
            <span>AVENZO TECHNOLOGIES</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading tracking-tight text-white mb-5 leading-tight">
            Ideas into <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-200">Digital Experiences</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We build innovative, pragmatic, and high-performance software solutions tailored for real-world commerce, digitizing manual workflows so businesses can thrive.
          </p>
        </div>
      </section>

      {/* 3. PRODUCT SPOTLIGHT: EASYLIST */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-lg p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-[#5046F2]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Featured Product</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#111827] tracking-tight">
                EasyList — Handwritten Orders Digitized in Seconds
              </h2>

              <p className="text-sm text-slate-600 leading-relaxed">
                Wholesale grocery and retail shopkeepers in India handle dozens of handwritten customer orders every day on loose chits and slips. EasyList automates this process using state-of-the-art multimodal AI, translating messy handwriting in both Tamil and English into clean, structured digital tables ready for billing and accounting.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Bilingual Script AI</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Accurate Tamil and English grocery term extraction</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">No Hallucinations</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Missing or uncertain quantities flagged for human review</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Layers className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Universal Exports</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Instant downloads to Excel (.xlsx), CSV, and PDF</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Cpu className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Resilient Architecture</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Automatic failover models, caching, and offline guards</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 p-6 rounded-2xl border border-indigo-100/60 flex flex-col justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center mx-auto mb-4">
                <img
                  src="/images/EasyList logo.png"
                  alt="EasyList"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <h3 className="text-lg font-bold font-heading text-[#111C35]">
                EasyList by Avenzo
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Designed and built with passion to simplify retail and wholesale operations.
              </p>
              <div className="mt-5 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#111C35] text-white text-xs font-semibold shadow-xs">
                <span>Version 1.0 Production Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LEADERSHIP TEAM SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider mb-2">
            Leadership Team
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-heading text-[#111827]">
            Meet the Founders of Avenzo
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            The dedicated team behind AVENZO TECHNOLOGIES and EasyList, blending engineering, strategy, and operations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {TEAM_MEMBERS.map((member) => {
            const hasValidImage = member.image && !imageErrors[member.name];

            return (
              <div
                key={member.name}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col items-center text-center group"
              >
                {/* Photo / Avatar */}
                <div className="relative mb-4">
                  {hasValidImage ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      onError={() => handleImageError(member.name)}
                      className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-slate-100 group-hover:ring-[#5046F2]/40 transition-all"
                    />
                  ) : (
                    <div
                      className={`w-24 h-24 rounded-full ${member.accentBg} ${member.accentColor} font-extrabold text-2xl flex items-center justify-center border-2 border-white shadow-sm ring-2 ring-slate-100 group-hover:ring-[#5046F2]/40 transition-all`}
                    >
                      {member.initials}
                    </div>
                  )}
                </div>

                {/* Member Info */}
                <h3 className="text-base font-bold font-heading text-[#111C35] leading-snug">
                  {member.name}
                </h3>
                <span className="text-xs font-semibold text-[#5046F2] mt-0.5">
                  {member.role}
                </span>

                <p className="text-xs text-slate-500 mt-3 leading-relaxed flex-1">
                  {member.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. VERIFIED CONTACT & FOOTER */}
      <footer className="mt-auto bg-[#111C35] text-white border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/images/EasyList logo.png"
                  alt="EasyList Logo"
                  className="w-8 h-8 rounded-lg object-contain shadow-sm"
                />
                <span className="text-xl font-bold font-heading tracking-tight text-white">
                  AVENZO <span className="text-[#5046F2]">TECHNOLOGIES</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
                Transforming ideas into digital experiences. EasyList is our flagship retail intelligence platform built to power local merchants and grocery suppliers.
              </p>
            </div>

            <div className="md:col-span-6 flex flex-col sm:flex-row gap-4 sm:justify-end">
              <a
                href="mailto:avenzotechnologies05@gmail.com"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-white transition-all"
              >
                <Mail className="w-4 h-4 text-[#5046F2]" />
                <span>avenzotechnologies05@gmail.com</span>
              </a>

              <a
                href="https://wa.me/918220575776"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs sm:text-sm font-semibold text-emerald-300 transition-all"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>+91 82205 75776</span>
                <ExternalLink className="w-3 h-3 text-emerald-400/80" />
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} AVENZO TECHNOLOGIES. All rights reserved.</p>
            <p className="font-medium text-slate-400">EasyList — Ideas into Digital Experiences</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;