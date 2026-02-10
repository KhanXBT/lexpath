import { motion } from 'framer-motion'
import { ArrowRight, Volume2, VolumeX } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import '../assets/lexpath_logo_animated.css'
import '../LandingPage.css'

function VideoLogo() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [loopEnabled, setLoopEnabled] = useState(false);

    const handleVideoEnd = () => {
        setLoopEnabled(true);
        setIsMuted(true);
        if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play();
        }
    };

    // Aggressive attempt to play muted immediately for autoplay compliance
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(e => console.log("Autoplay blocked even muted", e));
        }

        const startUnmuted = () => {
            if (videoRef.current && !loopEnabled) {
                videoRef.current.muted = false;
                videoRef.current.play().catch(e => console.error("Play failed", e));
                setIsMuted(false);
            }
        };

        // Listen for ANY interaction to unmute and play
        document.addEventListener('click', startUnmuted, { once: true });
        document.addEventListener('touchstart', startUnmuted, { once: true });
        return () => {
            document.removeEventListener('click', startUnmuted);
            document.removeEventListener('touchstart', startUnmuted);
        };
    }, [loopEnabled]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
                ref={videoRef}
                src="/logo-video.mp4"
                className="lexpath-logo-3d floating"
                muted={isMuted}
                loop={loopEnabled}
                onEnded={handleVideoEnd}
                playsInline
                style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
            />
            <div className="video-glow-underlay"></div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                        setIsMuted(videoRef.current.muted);
                    }
                }}
                className="volume-control"
                style={{
                    position: 'absolute', bottom: '10px', right: '10px',
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                    padding: '8px', cursor: 'pointer', color: '#2dd4bf', zIndex: 20
                }}
            >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
        </div>
    );
}

interface LandingPageProps {
    onEnter: () => void;
}

import { DottedSurface } from '../components/ui/dotted-surface';

// ... (previous imports)

export function LandingPage({ onEnter }: LandingPageProps) {
    return (
        <div className="landing-container">
            <DottedSurface className="absolute inset-0 z-0" />

            <div className="landing-overlay-gradient"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="hero-section"
            >
                <div className="logo-container">
                    <VideoLogo />
                    <div className="radiating-light"></div>
                </div>

                <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{
                        y: 0,
                        opacity: 1,
                        textShadow: [
                            "0 0 10px rgba(0, 243, 255, 0.3)",
                            "0 0 20px rgba(0, 243, 255, 0.6)",
                            "0 0 40px rgba(0, 243, 255, 0.8)",
                            "0 0 20px rgba(0, 243, 255, 0.6)",
                            "0 0 10px rgba(0, 243, 255, 0.3)"
                        ]
                    }}
                    transition={{
                        delay: 0.5,
                        textShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="brand-title"
                >
                    LEXPATH
                </motion.h1>

                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="tagline mono"
                >
                    ADVANCED ADVERSARY SIMULATOR
                </motion.p>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    <button className="enter-btn glow-teal" onClick={onEnter}>
                        ENTER WAR ROOM <ArrowRight size={20} />
                    </button>
                </motion.div>
            </motion.div>

            <footer className="landing-footer mono-text sm">
                <div className="footer-item">
                    <span>Made with</span>
                    <img src="/antigravity_icon.png" alt="Antigravity" className="footer-logo spin-slow" />
                    <span>Antigravity</span>
                </div>
                <span className="dot teal"></span>
                <div className="footer-item">
                    <span>Powered by</span>
                    <img src="/gemini_icon.png" alt="Gemini 3" className="footer-logo pulse-fast" />
                    <span>Gemini 3</span>
                </div>
            </footer>
        </div>
    )
}
