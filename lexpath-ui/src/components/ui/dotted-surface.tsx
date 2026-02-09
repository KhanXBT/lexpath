'use client';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

/**
 * DottedSurface - A high-performance 3D particle background.
 * Engineered for visibility and smooth 60fps animation.
 */
export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);

    // PERSISTENT REFS: Essential to survive React re-renders and avoid stale closures
    const countRef = useRef(0);
    const animationFrameRef = useRef<number>(0);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Configuration
        const SEPARATION = 120; // Slightly tighter for denser look
        const AMOUNTX = 50;
        const AMOUNTY = 50;
        const WAVE_AMPLITUDE = 120; // BOOSTED for visibility
        const WAVE_SPEED = 0.05;    // Smooth but noticeable

        // Scene setup
        const scene = new THREE.Scene();
        // Use a background color that matches the app's Void-BG
        scene.fog = new THREE.Fog(0x050b14, 2000, 10000);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            1,
            10000
        );
        camera.position.set(0, 400, 1000); // Higher angled view

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
        renderer.setSize(window.innerWidth, window.innerHeight);
        rendererRef.current = renderer;

        containerRef.current.appendChild(renderer.domElement);

        // Particle Geometry
        const numParticles = AMOUNTX * AMOUNTY;
        const positions = new Float32Array(numParticles * 3);
        const colors = new Float32Array(numParticles * 3);

        const geometry = new THREE.BufferGeometry();

        let i = 0;
        for (let ix = 0; ix < AMOUNTX; ix++) {
            for (let iy = 0; iy < AMOUNTY; iy++) {
                const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
                const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
                const y = 0;

                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;

                // Color based on theme, default to Holo-Teal for dark
                if (theme === 'dark' || !theme) {
                    colors[i * 3] = 0;      // R
                    colors[i * 3 + 1] = 0.95; // G (Teal-ish)
                    colors[i * 3 + 2] = 1;    // B
                } else {
                    colors[i * 3] = 0.1;
                    colors[i * 3 + 1] = 0.1;
                    colors[i * 3 + 2] = 0.1;
                }
                i++;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 6,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending, // Glow effect
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // ANIMATION LOOP
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            const count = countRef.current;
            const positionAttribute = geometry.attributes.position;
            const posArray = positionAttribute.array as Float32Array;

            let idx = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    const y = (Math.sin((ix + count) * 0.3) * WAVE_AMPLITUDE) +
                        (Math.sin((iy + count) * 0.5) * WAVE_AMPLITUDE);

                    posArray[idx * 3 + 1] = y;
                    idx++;
                }
            }

            positionAttribute.needsUpdate = true;
            renderer.render(scene, camera);

            // Update persistent count
            countRef.current += WAVE_SPEED;
        };

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener('resize', handleResize);
        animate();

        // CLEANUP
        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            // Dispose Three.js objects to prevent memory leaks
            geometry.dispose();
            material.dispose();
            renderer.dispose();

            if (containerRef.current && renderer.domElement) {
                // Ensure the child still exists before removing
                if (containerRef.current.contains(renderer.domElement)) {
                    containerRef.current.removeChild(renderer.domElement);
                }
            }
        };
    }, [theme]); // Re-run only on theme change to update colors

    return (
        <div
            ref={containerRef}
            className={cn('pointer-events-none fixed inset-0 -z-1', className)}
            {...props}
        />
    );
}
