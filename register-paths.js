// Register path aliases for runtime
// This file is loaded with -r flag before any other modules
const tsConfigPaths = require("tsconfig-paths");
const path = require("path");

const baseUrl = path.resolve(__dirname);

// Map all path aliases to dist/ directory
const paths = {
  "@/*": ["dist/*"],
  "@/config/*": ["dist/config/*"],
  "@/controllers/*": ["dist/controllers/*"],
  "@/services/*": ["dist/services/*"],
  "@/repositories/*": ["dist/repositories/*"],
  "@/middleware/*": ["dist/middleware/*"],
  "@/utils/*": ["dist/utils/*"],
  "@/types/*": ["dist/types/*"],
  "@/queues/*": ["dist/queues/*"],
  "@/workers/*": ["dist/workers/*"],
  "@/validators/*": ["dist/validators/*"],
  "@/routes/*": ["dist/routes/*"],
  "@/jobs/*": ["dist/jobs/*"],
  "@/lib/*": ["dist/lib/*"],
};

tsConfigPaths.register({
  baseUrl: baseUrl,
  paths: paths,
});

