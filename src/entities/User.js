import { appApi } from "@/api/appClient";

export const User = {
  me: appApi.auth.me,
  login: appApi.auth.login,
  register: appApi.auth.register,
  logout: appApi.auth.logout,
  changePassword: appApi.auth.changePassword,
};
