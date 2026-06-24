---
trigger: model_decision
description: when working on front-end pages, these are visual design guidelines
---

### 🗺️ Layout & Navigation

* Place key actions and value props above the fold.
* Align elements to a consistent grid for visual flow.
* Limit primary nav items to 5–7 choices.
* Use clear, descriptive labels in menus.
* Keep your logo linked to home in the same spot.
* Highlight the current page in your nav.

### 🔍 Scanning & Visual Hierarchy

* Design in an “F” or “Z” scanning pattern.
* Use size, weight, and color to show importance.
* Break content with headings, subheadings, and bullets where natural. 
* Limit body text lines to 50–75 characters.
* Set body font ≥16 px and line-height 1.4–1.6×.
* Reserve bold/color for true emphasis.

### 📄 Content & Copy

* Write scannable sentences and short paragraphs.
* Use chunking: group related ideas under clear headers.
* Lead with your core value proposition.
* Use simple, familiar words—not jargon.
* Add microcopy to guide next steps.
* Preview link destinations with tooltips or labels.

### 🖋️ Forms & Inputs

* Place labels above fields, aligned left.
* Group related fields with clear boundaries or whitespace.
* Provide inline validation and real-time feedback.
* Pre-fill sensible defaults when possible.
* Use progressive disclosure for long or optional fields.
* Put the primary call-to-action button after the last field.

### ⚡ Feedback & Error Handling

* Show system status (spinners, progress bars) for loading.
* Use clear, polite, action-oriented error messages.
* Offer undo or confirm for destructive actions.

### 🧠 Norman's Principles of Interaction

*   **Discoverability & Affordances**: Make it obvious what users can do. Buttons should look clickable, sliders should look draggable. The design itself should suggest its function.
*   **Signifiers**: Use explicit cues like icons, labels, and consistent styling to signal where and how to interact. Don't make users guess.
*   **Feedback**: Acknowledge every user action with immediate and clear feedback. Use visual cues (highlights, spinners), sounds, or haptics to confirm the system is responding.
*   **Mapping**: Create a natural and logical connection between a control and its effect. Swiping up should move content up. Volume sliders should go from left (quiet) to right (loud).
*   **Constraints**: Guide users and prevent errors by limiting available actions. Disable buttons that aren't relevant, use dropdowns instead of free-text for specific choices.
*   **Conceptual Model**: Ensure the interface presents a consistent and understandable system. Users should be able to predict what will happen when they perform an action.

### ♿ Accessibility & Performance

* Ensure text-to-background contrast meets WCAG AA.
* Make touch targets at least 44 × 44 px on mobile.
* Write semantic HTML and use ARIA roles appropriately.
* Optimize images and lazy-load offscreen content.
* Aim for page load < 3 seconds on mobile networks.
* Test keyboard-only navigation and focus order.

Whitespace isn’t empty—generous margins and spacing boost readability by easing cognitive load and speeding eye tracking.
**Key takeaway:** a clear grid plus typographic hierarchy with ample whitespace creates **balance**, **clarity**, and **scannability**.

Below, 25 NN/g–inspired rules for margins, spacing, headline sizing, font sizing, and whitespace.

### 🎯 Margin & Gutter

1. Frame content with ≥10% viewport margins to anchor and protect.
2. Align everything to an 8 px baseline grid for consistent rhythm.
3. Match column gutters to page margins for visual symmetry.
4. Signal new sections with whitespace at least as tall as the page margin.
5. Group form elements with 8 px between label and field, 16–24 px between groups.

### 🖋️ Spacing & Typography

6. Use body text ≥16 px for legibility across devices.
7. Set line height to 1.5–1.75 × font size for smooth reading.
8. Limit line length to 50–75 characters to aid focus.
9. Add 4–8 px tracking on uppercase headlines for glanceability.
10. Reserve all-caps for labels; use sentence case in paragraphs.
11. Stick to two typefaces and consistent weight/italic variants.
12. Space paragraphs by 1.5–2 × line height to group ideas.

### 📏 Headline & Font Sizing

13. Establish a modular scale (1.25–1.618 ratio) for harmonious sizing.
14. Make H1 ≥2 × base size, H2 ≈1.5 ×, H3 ≈1.25 × to guide the eye.
15. Limit to three heading sizes—small, medium, large—for clarity.
16. Use 24–32 px for primary headlines; 18–20 px for secondary.
17. Give each heading a top margin of 2 × line height to separate sections.
18. Align headings to the baseline grid for consistent vertical flow.

### ⚖️ Balance & Whitespace

19. Group related items tightly; separate unrelated ones generously.
20. Distribute whitespace symmetrically around focal elements.
21. Leverage the golden ratio for element sizing and gaps.
22. Ensure ≥8 px clear space around buttons and interactive controls.
23. Apply uniform padding inside cards and UI elements for stability.
24. Use a defined spacing scale (4, 8, 16, 24, 32 px) for predictability.
25. Test across breakpoints; tweak margins and font sizes to keep balance.


Key Style Pillars 
1. Typography-Led Design
Primary Font:Elegant, high contrast, often large and center-aligned
Secondary Font: Used for body copy, nav, labels — modest and clean
Typography is the hero — large headers, lots of whitespace, precise tracking
Embrace large type sizes for emotion and impact — hero headers should command space.

3. Use Editorial Layouts
Build with a modular, grid-based layout — lots of whitespace, visual rhythm, and breathing room. Center-align key content in hero sections and stack vertically on mobile. Big type, small captions. Mobile-first stacking.
Often structured like a magazine: wide gutters, generous margins. Use generous padding and margins (24–48px) — spacing is branding. Section blocks breathe — nothing cramped.

3. Use Deliberate Motion animations
Use subtle, elegant transitions — 0.2–0.3s ease-in-out fades or scaling. Never flashy. Micro-interactions only. Scroll reveals, slight fades. Smooth. 

🎨 **Shapes, Corners & Surfaces**

* Squircles and super-elliptical corners
* Very large border-radius cards and buttons
* Rounded pill buttons and pill filters
* Chip-style tags and filters
* Floating, layered panels with drop shadows
* Soft, realistic shadows (ambient + directional)
* Inset shadows for “pressed” states
* 3D-ish UI elements with light and shadow play
* Soft neumorphism
* Skeuomorphic micro-details (subtle, tactile cues)
* Frosted glass overlays and blur panels
* Soft, blurred background blobs and shapes

🧱 **Layout, Structure & Compositional Patterns**

* Grid-based, card-style layouts
* Asymmetric, broken grid layouts
* Full-bleed imagery with rounded inner content
* Split-screen layouts (content + imagery)
* Vertical rhythm driven by consistent spacing scales
* Minimal “chrome” with lots of white/negative space
* Avatar stacks and overlapping badges
* Dock-style bottom navigation on mobile and desktop
* Modal bottom sheets and side drawers
* Sticky headers and sticky sub-navigation

🔤 **Typography & Text Treatments**

* Oversized typography for hero headlines
* Fluid, responsive typography (clamp-based scales)
* Duotone and monotone color treatments for type + imagery
* System font stacks with small custom tweaks

🌈 **Color, Texture & Visual Style**

* High-contrast, AAA-accessible color palettes
* Soft gradients and gradient meshes
* Subtle noise or grain overlays for texture
* Brutalist web design accents

🎞 **Motion, Interaction & Feedback**

* Micro-interactions on hover, tap, and scroll
* Morphing shapes and motion transitions
* Scroll-triggered reveals and animations
* Parallax scrolling sections
* Animated icons and lottie-style illustrations
* Skeleton loaders and shimmering content placeholders
* Progress trackers and stepper components

**Navigation Patterns**
* Sticky headers and sticky sub-navigation
* Modal bottom sheets and side drawers, never hidden

🌗 **Theming, Modes & Accessibility**

* Dark mode as a first-class theme
* Dynamic theming (light/dark/system color sync)
* Accessible focus states and visible outlines
* Reduced motion / prefers-reduced-motion support

🧩 **Icons & Illustration Style**

* Iconography built from simple geometric primitives
* Line-based, minimalist icon sets
* Hand-drawn or organic accent illustrations
