type PageHeader = {
  eyebrow: string;
  title: string;
  description: string;
  tag?: string;
};

export const pageHeaders: Record<string, PageHeader> = {
  inventory: {
    eyebrow: "YOUR COMPONENT WORKSPACE",
    title: "物料库",
    description: "从一颗电阻，到下一个灵感。让所有元件，都触手可及。",
    tag: "我的元件收藏",
  },
  overview: {
    eyebrow: "A LITTLE ORDER, A LOT MORE POSSIBILITY",
    title: "工作台总览",
    description: "你的元件，你的创造。一眼了解今天的物料状态。",
  },
  locations: {
    eyebrow: "A PLACE FOR EVERY PART",
    title: "库位管理",
    description: "给每一颗元件一个地址，下一次寻找，从容一点。",
  },
  movements: {
    eyebrow: "EVERY MOVEMENT TELLS A STORY",
    title: "出入库记录",
    description: "从采购到创造，每一次元件流动都有迹可循。",
  },
  projects: {
    eyebrow: "FROM PARTS TO POSSIBILITIES",
    title: "项目 BOM",
    description: "把元件串成一个灵感。核对需求，提前准备下一次创造。",
  },
  agents: {
    eyebrow: "BUILT FOR YOU. READY FOR YOUR AGENTS.",
    title: "智能体接入",
    description: "让你的智能助手读懂物料库，为查料、备料和补货提供准确数据。",
  },
  settings: {
    eyebrow: "A WORKSPACE THAT IS YOURS",
    title: "系统设置",
    description: "数据由你掌控，让工作台保持清晰、可靠、有序。",
  },
};
