type PageHeader = {
  title: string;
};

export const pageHeaders: Record<string, PageHeader> = {
  inventory: {
    title: "物料库",
  },
  overview: {
    title: "工作台总览",
  },
  locations: {
    title: "库位管理",
  },
  movements: {
    title: "出入库记录",
  },
  projects: {
    title: "项目 BOM",
  },
  agents: {
    title: "智能体接入",
  },
  settings: {
    title: "系统设置",
  },
};
