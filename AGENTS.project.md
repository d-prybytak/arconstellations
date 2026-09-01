I'd like to develop an app like StartWalk 2, but for non-Apple AR-glasses / AR-headsets like Moohan or Magic Leap 2, and mobile (Android). The main behaviour should look like I'd like to see the position and constellation groups (stars and joints between them) right/exact position at the sky according to user geo position and looking direction - in outdoor mode. With an on-premises mode user might setup initial position if the sky by him/herself. 

I'd like to you develop a technical guide of how exact to develop this project step-by-step. 
I see the main problems connected with the fact, it's quite complex:
1.  UX in 3D: working with hands and gestures tracking  to perform best-possible UX. 
2. To make an ultimatic visualizer for cosmos data: solar system, stars, constellations of the Milky Way, significant observed events in the universe (supernova explosion, black holes, etc.), distant galaxies .... 

One of the central parts of the application, I see cooperation with organizations that have relevant data as NASA or others (might be used open-sources databases). I see the value of the application, first of all, the creation of beautiful visualizations of these data in 3D and the opportunity to see “directly in the sky” with the help of AR-glasses of the constellation, as well as "clicking on them" - an animation of how selected Space object like Star, Constellation or sth. - is going closer to user (gathered from the Sky) and presenting then right behind him / her with corresponded animation (e.g. just rotating) - amazing! Just a constellation right behind user itself!. 

Anyway, the basic version should be implemented and working right on device. 

We could consider development for  non-Apple AR-headsets, and AR-glasses through AndroidXR and Jetpack XR SDK using Android Studio with XR Headset Simulator  to resolve problems with complex 3D development in AR.
So, the main development toolset is: AndroidXR + Jetpack XR SDK + Android Studio (installed on Mac with Apple chip) + XR Headset Emulator.

An appropriate conversation with ChatGPT - https://chatgpt.com/share/e/686e5ec2-a41c-8005-81c7-71d16665c1a7

The first version might be a very simple with performing of Sky demo with 360, cropped by the ground (outdoor mode) or by floor plane (on-premises mode) with simple 3D stars (bright dot even simply animated) and constellations, using open-sourced data of Cosmos.

Then, I'll define next milestones.  

Another Tools:
Gemini Ultra Deep Think Pro mode,
Cursor,
Codex CLI, 
GitHub,
Gemini CLI

This conversation belongs to a Grok project. The project's files are mounted at `/workspace/artifacts` — look there for user-provided sources before concluding the workspace has no project files. Files written there persist to the project across conversations.