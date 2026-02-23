'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Download,
  Monitor,
  Wifi,
  WifiOff,
  Shield,
  RefreshCw,
  BarChart3,
  Package,
  Bot,
  Receipt,
  ChevronRight,
  Check,
  Github,
  ArrowRight,
  Pill,
  Building2,
  Users,
  FileText,
} from 'lucide-react';

const features = [
  {
    icon: WifiOff,
    title: 'Offline-First',
    description: 'Continue selling even without internet. Data syncs automatically when back online.',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Real-time stock tracking with low stock alerts and expiry date monitoring.',
  },
  {
    icon: Shield,
    title: 'Controlled Substances',
    description: 'Kenya Poisons Act compliant register for controlled medicine tracking.',
  },
  {
    icon: Bot,
    title: 'AI Pharmacist',
    description: 'Intelligent assistant for drug interactions and dosage guidance.',
  },
  {
    icon: Receipt,
    title: 'VAT Compliant',
    description: '16% VAT calculation with KRA PIN display on all receipts.',
  },
  {
    icon: RefreshCw,
    title: 'Auto Updates',
    description: 'Seamless automatic updates ensure you always have the latest features.',
  },
];

const screenshots = [
  { src: '/download/pos.png', alt: 'Point of Sale', label: 'Fast POS Checkout' },
  { src: '/download/inventory.png', alt: 'Inventory', label: 'Inventory Management' },
  { src: '/download/dashboard.png', alt: 'Dashboard', label: 'Analytics Dashboard' },
  { src: '/download/receipt.png', alt: 'Receipt', label: 'Professional Receipts' },
];

export default function DownloadPage() {
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="DawaCare" width={40} height={40} />
            <span className="font-bold text-xl text-gray-900">DawaCare</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-emerald-600 transition-colors"
            >
              Web App
            </Link>
            <a
              href="#download"
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Monitor className="w-4 h-4" />
                Desktop Application
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                DawaCare POS
                <span className="block text-emerald-600">Pharmacy Management</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                The complete pharmacy management solution designed for Kenyan pharmacies. 
                Works offline, syncs online, and keeps you compliant with PPB and KRA regulations.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="#download"
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all hover:shadow-lg hover:shadow-emerald-200"
                >
                  <Download className="w-5 h-5" />
                  Download for Free
                </a>
                <a
                  href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all"
                >
                  <Github className="w-5 h-5" />
                  View on GitHub
                </a>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Free to use
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  No subscription
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Auto updates
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-gray-400 text-sm ml-2">DawaCare POS</span>
                </div>
                <div className="relative aspect-[16/10]">
                  <Image
                    src="/download/pos.png"
                    alt="DawaCare POS Screenshot"
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 bg-white rounded-xl shadow-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Wifi className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Online Mode Ready</p>
                    <p className="text-xs text-gray-500">Synced with cloud</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              DawaCare POS comes packed with features designed specifically for Kenyan pharmacies.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-2xl p-6 hover:bg-emerald-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">See It In Action</h2>
            <p className="text-gray-600">Explore the intuitive interface designed for speed and efficiency.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {screenshots.map((screenshot, index) => (
              <button
                key={screenshot.label}
                onClick={() => setActiveScreenshot(index)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeScreenshot === index
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-emerald-50'
                }`}
              >
                {screenshot.label}
              </button>
            ))}
          </div>

          <motion.div
            key={activeScreenshot}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-w-4xl mx-auto"
          >
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-gray-400 text-sm ml-2">{screenshots[activeScreenshot].label}</span>
            </div>
            <div className="relative aspect-[16/10]">
              <Image
                src={screenshots[activeScreenshot].src}
                alt={screenshots[activeScreenshot].alt}
                fill
                className="object-cover object-top"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-20 bg-gradient-to-b from-emerald-600 to-emerald-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-white mb-4">Download DawaCare POS</h2>
            <p className="text-emerald-100 mb-10 max-w-xl mx-auto">
              Get started with the most comprehensive pharmacy management solution for Kenya. Free to download and use.
            </p>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Windows */}
              <a
                href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS-Setup-1.0.73.exe"
                className="bg-white rounded-2xl p-6 hover:shadow-xl transition-all group"
              >
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Windows</h3>
                <p className="text-sm text-gray-500 mb-3">Windows 10/11 (64-bit)</p>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                  <Download className="w-4 h-4" />
                  Download v1.0.73
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>

              {/* macOS */}
              <a
                href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS-1.0.73.dmg"
                className="bg-white rounded-2xl p-6 hover:shadow-xl transition-all group"
              >
                <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">macOS</h3>
                <p className="text-sm text-gray-500 mb-3">macOS 10.15+ (Intel & Apple Silicon)</p>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                  <Download className="w-4 h-4" />
                  Download v1.0.73
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>

              {/* Linux AppImage */}
              <a
                href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/DawaCare-POS-1.0.73.AppImage"
                className="bg-white rounded-2xl p-6 hover:shadow-xl transition-all group"
              >
                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.503 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.117.85.434 1.651 1.007 2.347.508.63 1.173 1.163 1.973 1.554.78.39 1.682.64 2.663.758.926.108 1.927.104 2.966-.047 2.036-.32 4.09-1.19 5.685-2.744 1.567-1.525 2.733-3.678 2.996-6.293.27-2.665-.484-5.678-2.763-8.228-2.138-2.392-5.284-3.696-8.824-3.696zm-.02 1.087c3.12.008 5.96 1.082 7.79 3.103 2.007 2.214 2.752 4.887 2.529 7.103-.225 2.258-1.203 4.12-2.54 5.42-1.366 1.327-3.134 2.092-4.864 2.353-.856.13-1.691.13-2.46.046-.755-.08-1.442-.265-2.034-.542-.596-.273-1.096-.65-1.455-1.086-.384-.473-.6-1.033-.664-1.607-.092-.614.008-1.222.209-1.851.509-1.524 1.58-3.038 2.374-3.983.786-.97 1.089-2.058 1.148-3.164.02-.354.041-.71.061-1.054.105-1.656-.142-3.685 1.024-4.499.482-.29 1.169-.396 1.882-.239z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Linux (AppImage)</h3>
                <p className="text-sm text-gray-500 mb-3">Universal Linux package</p>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                  <Download className="w-4 h-4" />
                  Download v1.0.73
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>

              {/* Linux DEB */}
              <a
                href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system/releases/latest/download/dawacare-pos_1.0.73_amd64.deb"
                className="bg-white rounded-2xl p-6 hover:shadow-xl transition-all group"
              >
                <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.846c5.595 0 10.154 4.559 10.154 10.154 0 5.595-4.559 10.154-10.154 10.154-5.595 0-10.154-4.559-10.154-10.154C1.846 6.405 6.405 1.846 12 1.846zm2.4 5.477c-1.983 0-3.6 1.617-3.6 3.6 0 1.983 1.617 3.6 3.6 3.6.432 0 .843-.08 1.224-.222l-1.353-2.346h2.706c.015-.171.023-.345.023-.521 0-1.983-1.617-3.6-3.6-3.6v-1.511zm-4.8 0v7.2h1.8v-7.2h-1.8z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Debian/Ubuntu</h3>
                <p className="text-sm text-gray-500 mb-3">.deb package for Debian-based systems</p>
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium group-hover:gap-3 transition-all">
                  <Download className="w-4 h-4" />
                  Download v1.0.73
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>
            </div>

            <p className="text-emerald-200 text-sm mt-8">
              All downloads include automatic updates. Choose the version for your operating system.
            </p>
          </motion.div>
        </div>
      </section>

      {/* System Requirements */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">System Requirements</h3>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-4">
              <Monitor className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Display</p>
              <p className="text-sm text-gray-500">1280x720 minimum</p>
            </div>
            <div className="p-4">
              <Package className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Storage</p>
              <p className="text-sm text-gray-500">500MB free space</p>
            </div>
            <div className="p-4">
              <BarChart3 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-gray-900">Memory</p>
              <p className="text-sm text-gray-500">4GB RAM recommended</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="DawaCare" width={40} height={40} />
              <div>
                <p className="font-semibold">DawaCare POS</p>
                <p className="text-sm text-gray-400">Empowering Kenyan Pharmacies</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/login" className="hover:text-white transition-colors">Web App</Link>
              <a
                href="https://github.com/GodfreyNjoro/dawacare-pharmacy-system"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} DawaCare. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
