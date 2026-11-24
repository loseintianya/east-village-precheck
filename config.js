/**
 * East Village Move-In Pre-Check & Key Handoff Web App
 * 团队默认配置（部署静态网页前可在此填写，填写后手机打开即自动生效，也可在网页右上角「设置」中覆盖）
 */
window.EV_APP_CONFIG = {
  // 已自动关联部署好的 Google Apps Script Web App URL
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxEChwGtkA96DKDC9kEoJoFdx6pRibdFSYhsaO5u6vHRoq_4sX-EsRHrYKn2rc32xHs_Q/exec",

  // 访问口令（为安全起见不在公开代码中写死；如需启用口令，请在 Code.gs 设置后于手机网页右上角「⚙️ 设置」填写）
  ACCESS_PIN: "",

  // 第 4 页「36-Hour Supplement Email」默认接收邮箱（如 leasing@burlewgroup.com）
  DEFAULT_SUBMISSION_EMAIL: "",

  // 默认检查员 / 管理员姓名（可选）
  DEFAULT_STAFF_NAME: "",

  // 图片压缩参数（保证手机上传速度快、PDF 清晰且体积适中）
  PHOTO_MAX_DIMENSION: 1500,
  PHOTO_JPEG_QUALITY: 0.82
};
