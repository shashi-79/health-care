module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@rhc/tools/*"],
            message: "Only BG agent modules may import tools directly."
          },
          {
            group: ["@rhc/db/ui-messages"],
            message: "UI transcript store is isolated from agent logic."
          }
        ]
      }
    ]
  },
  overrides: [
    {
      files: ["packages/agents/src/bg-agent.ts"],
      rules: {
        "no-restricted-imports": "off"
      }
    }
  ]
};
