"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/app" className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">Terms and Conditions</h1>
          <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-white/10 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing and using Dashmint, you accept and agree to be bound by the terms and provision of this agreement. 
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Video Submission and Ownership</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              When you submit dashcam videos to Dashmint, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>You are the sole owner of the video content or have obtained all necessary rights and permissions</li>
              <li>The video does not infringe upon any third-party rights, including copyright, privacy, or publicity rights</li>
              <li>You have the authority to grant Dashmint the rights to use, process, and distribute the video for AI training purposes</li>
              <li>All location and timestamp data provided is accurate and legitimate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Content Removal</h2>
            <p className="text-gray-300 leading-relaxed">
              In the event of any copyright disputes, claims, or violations, Dashmint reserves the right to immediately 
              remove the video content from the platform. You acknowledge that Dashmint may remove content at its sole 
              discretion without prior notice if it determines the content violates these terms or applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Usage and AI Training</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              By submitting videos to Dashmint, you grant us the right to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Use your video content for AI model training and development</li>
              <li>Process and analyze the video data, including metadata such as location and timestamps</li>
              <li>Share anonymized or aggregated data with AI companies and research institutions</li>
              <li>Register ownership information on Story Protocol or similar blockchain-based systems</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Points and Rewards</h2>
            <p className="text-gray-300 leading-relaxed">
              Points are awarded based on video submissions and usage by AI companies. Points have no monetary value 
              and cannot be exchanged for cash. Dashmint reserves the right to modify, suspend, or terminate the points 
              system at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Intellectual Property Protection</h2>
            <p className="text-gray-300 leading-relaxed">
              Dashmint uses Story Protocol and similar technologies to register and protect your intellectual property 
              rights. However, you acknowledge that once content is used for AI training, it may be incorporated into 
              trained models. You retain ownership of the original content but grant usage rights as specified in these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Privacy and Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We take your privacy seriously. Location data and personal information are handled in accordance with our 
              Privacy Policy. We implement security measures to protect your data, but cannot guarantee absolute security 
              against all threats.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Prohibited Content</h2>
            <p className="text-gray-300 leading-relaxed mb-3">
              You agree not to submit content that:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Contains illegal activities or violates any laws</li>
              <li>Infringes on third-party intellectual property rights</li>
              <li>Contains personally identifiable information without consent</li>
              <li>Is misleading, fraudulent, or contains false information</li>
              <li>Contains harmful, abusive, or offensive material</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              Dashmint shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
              resulting from your use of the service or submission of content. Our total liability shall not exceed 
              the amount you have earned in points through the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Modifications to Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              Dashmint reserves the right to modify these terms and conditions at any time. Continued use of the service 
              after changes constitutes acceptance of the new terms. We recommend reviewing these terms periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Contact Information</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us through the platform's 
              support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}



