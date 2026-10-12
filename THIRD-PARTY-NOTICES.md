# Third-party components / Componentes de terceros

ASRPRO Studio source code is licensed under CC0-1.0. This does not relicense
the manufacturer SDK, models, libraries, compiler, or programming agent.

ASRPRO-Studio.exe does not contain the manufacturer SDK, models,
compiler or installer. It locates a compatible local Tianwen installation or
offers to download the installer directly from its official HTTPS source.
The verified installer is 2025-1a0907. The user approves installation and reviews
its license; no silent acceptance or automatic elevation is performed.
An SDK workspace is copied locally at runtime to avoid modifying Tianwen.
This removes the bundled SDK redistribution issue, but does not certify all
remaining dependencies or derivative firmware code for public distribution.

Manufacturer files are downloaded or located separately on the user's PC.
They are not included in the current GitHub release or source repository.
Building the Studio executable requires no manufacturer installation.
Compiling board firmware at runtime requires the externally installed SDK.

Node.js is bundled as a runtime. Its license notice accompanies the runtime.
JavaScript dependencies retain their respective licenses in node_modules.
The RISC-V compiler and SDK components retain their own license notices.
Some components may impose additional source-distribution obligations; this
package is not a licensing audit or a public redistribution clearance.

El codigo propio es CC0-1.0. Los archivos del fabricante no se relicencian.
El ejecutable actual y el repositorio no incluyen el SDK ni el instalador
Tianwen; se obtienen aparte. Conservar avisos no sustituye permisos.
