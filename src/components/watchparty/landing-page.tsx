'use client'

import { motion } from 'framer-motion'
import {
  MonitorPlay,
  Youtube,
  ScreenShare,
  FileUp,
  Link2,
  RefreshCw,
  MessageCircle,
  ListVideo,
  Video,
  CirclePlus,
  Users,
  LogIn,
  Shuffle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LandingPageProps {
  onCreateRoom: () => void
}

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
}

const features1 = [
  { icon: MonitorPlay, title: 'VBrowser', desc: 'Watch together on a virtual browser running in the cloud.' },
  { icon: Youtube, title: 'YouTube', desc: 'Watch videos together from YouTube.' },
  { icon: ScreenShare, title: 'Screensharing', desc: 'Share a browser tab or your desktop.' },
  { icon: FileUp, title: 'File', desc: 'Upload and stream your own file.' },
  { icon: Link2, title: 'URL', desc: 'Paste in a video URL for everyone to watch from.' },
]

const features2 = [
  { icon: RefreshCw, title: 'Synchronized Play', desc: 'Starts, stops, and seeks are synchronized to everyone, so take those restroom and snack breaks without worrying about falling behind.' },
  { icon: MessageCircle, title: 'Chat', desc: 'Chat with others in your room. Memes and inside jokes encouraged.' },
  { icon: ListVideo, title: 'Playlists', desc: 'Set up a whole list of videos to play next, and rearrange to your heart\'s content.' },
  { icon: Video, title: 'Video Chat', desc: 'Jump into video chat if you\'d rather be face-to-face.' },
]

const stepperSteps = [
  { step: 1, label: 'Make a room' },
  { step: 2, label: 'Share link with friends' },
  { step: 3, label: 'Pick something to watch' },
  { step: 4, label: 'Success!' },
]

export default function LandingPage({ onCreateRoom }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#222] text-white flex flex-col">
      {/* Header - matches WatchParty top bar */}
      <header className="flex items-center justify-between px-2 sm:px-4 py-1.5 flex-wrap gap-2 bg-[#1b1b1b] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center no-underline">
            <img src="/logo-icon.png" alt="WatchParty" className="w-14 h-14" />
          </a>
          <a href="/" className="flex items-center no-underline">
            <span className="text-[30px] font-bold uppercase text-[#2185d0] leading-[30px]">Watch</span>
            <span className="text-[30px] font-bold uppercase text-[#21ba45] leading-[30px] ml-auto">Party</span>
          </a>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="https://github.com/howardchung/watchparty"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded flex items-center justify-center bg-[#555] hover:bg-[#666] transition-colors"
            title="GitHub"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
          <Button
            size="lg"
            className="bg-[#2185d0] hover:bg-[#1a6db5] text-white font-semibold gap-2"
            onClick={onCreateRoom}
          >
            <CirclePlus className="w-5 h-5" />
            New Room
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="text-gray-300 hover:text-white font-semibold gap-2"
          >
            <LogIn className="w-5 h-5" />
            Sign in
          </Button>
        </div>
      </header>

      {/* Hero 1 - "Watch videos together with friends anywhere." */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="flex flex-col lg:flex-row items-center gap-0 px-8 lg:px-16 py-8 lg:py-12 max-w-7xl mx-auto w-full"
      >
        <motion.div variants={fadeInUp} className="flex-1 p-8 space-y-4">
          <div className="text-4xl sm:text-5xl font-bold leading-tight">
            Watch videos together with friends anywhere.
          </div>
          <div className="text-lg text-gray-400">No registration or download required.</div>
          <div className="mt-2">
            <Button
              size="lg"
              className="bg-[#2185d0] hover:bg-[#1a6db5] text-white font-semibold text-xl gap-2 h-14 px-8"
              onClick={onCreateRoom}
            >
              <CirclePlus className="w-6 h-6" />
              New Room
            </Button>
          </div>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex-1">
          <img
            src="/hero-watch.png"
            alt="WatchParty interface"
            className="w-full rounded-xl"
          />
        </motion.div>
      </motion.section>

      {/* Features 1 - Source tabs */}
      <section className="px-8 lg:px-16 py-8 max-w-7xl mx-auto w-full">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="flex flex-wrap justify-center gap-0"
        >
          {features1.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              className="flex flex-col items-center text-center p-4 min-w-[180px] flex-1"
            >
              <feature.icon className="w-20 h-20 text-gray-300 mb-2" strokeWidth={1.5} />
              <h4 className="font-semibold text-white text-lg mb-1">{feature.title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Hero 2 - "React to moments together." - green bg */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={staggerContainer}
        className="flex flex-col lg:flex-row-reverse items-center gap-0 px-8 lg:px-16 py-8 lg:py-12 max-w-7xl mx-auto w-full bg-[#21ba45]/10"
      >
        <motion.div variants={fadeInUp} className="flex-1 p-8 space-y-4">
          <div className="text-4xl sm:text-5xl font-bold leading-tight">
            React to moments together.
          </div>
          <div className="text-lg text-gray-400">Find moments of shared joy even when you&apos;re apart.</div>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex-1">
          <img
            src="/hero-react.png"
            alt="Chat and reactions"
            className="w-full rounded-xl"
          />
        </motion.div>
      </motion.section>

      {/* Features 2 */}
      <section className="px-8 lg:px-16 py-8 max-w-7xl mx-auto w-full">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="flex flex-wrap justify-center gap-0"
        >
          {features2.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              className="flex flex-col items-center text-center p-4 min-w-[180px] flex-1"
            >
              <feature.icon className="w-20 h-20 text-gray-300 mb-2" strokeWidth={1.5} />
              <h4 className="font-semibold text-white text-lg mb-1">{feature.title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Hero 3 - Theater mode */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={staggerContainer}
        className="flex flex-col lg:flex-row items-center gap-0 px-8 lg:px-16 py-8 lg:py-12 max-w-7xl mx-auto w-full"
      >
        <motion.div variants={fadeInUp} className="flex-1 p-8 space-y-4">
          <div className="text-4xl sm:text-5xl font-bold leading-tight">
            Theater mode.
          </div>
          <div className="text-lg text-gray-400">Bring video and chat front-and-center for minimal distractions.</div>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex-1">
          <img
            src="/hero-theater.png"
            alt="Theater mode"
            className="w-full rounded-xl"
          />
        </motion.div>
      </motion.section>

      {/* Get Started Stepper */}
      <section className="px-8 py-12 flex flex-col items-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="max-w-4xl mx-auto text-center space-y-12 w-full"
        >
          <motion.div variants={fadeInUp} className="text-4xl sm:text-5xl font-bold">
            Get started!
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
            {stepperSteps.map((step, idx) => (
              <div key={step.step} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#2185d0] flex items-center justify-center text-white font-bold text-lg">
                    {step.step}
                  </div>
                  <span className="text-sm text-gray-300 font-medium max-w-[120px] text-center">{step.label}</span>
                </div>
                {idx < stepperSteps.length - 1 && (
                  <div className="h-0.5 w-8 sm:w-16 bg-gray-600 mx-2 hidden sm:block" />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Discord Bot section - green bg */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        variants={staggerContainer}
        className="flex flex-col lg:flex-row-reverse items-center gap-0 px-8 lg:px-16 py-8 lg:py-12 max-w-7xl mx-auto w-full bg-[#21ba45]/10"
      >
        <motion.div variants={fadeInUp} className="flex-1 p-8 space-y-4">
          <div className="text-3xl sm:text-4xl font-bold leading-tight">
            Add the WatchParty Discord bot to your server to easily generate WatchParty links.
          </div>
          <div className="text-lg text-gray-400">/watch to generate a new empty room</div>
          <div className="text-lg text-gray-400">/watch video &lt;URL_HERE&gt; to create a room with a video</div>
          <div className="pt-2">
            <Button
              size="lg"
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Add to Discord
            </Button>
          </div>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex-1">
          <img
            src="/hero-theater.png"
            alt="Discord bot"
            className="w-full rounded-xl"
          />
        </motion.div>
      </motion.section>

      {/* Footer */}
      <footer className="px-4 py-4 text-sm text-gray-400 mt-auto bg-[#1b1b1b] border-t border-[#333]">
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <span>·</span>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <span>·</span>
          <a href="#" className="hover:text-white transition-colors">FAQ</a>
        </div>
      </footer>
    </div>
  )
}
