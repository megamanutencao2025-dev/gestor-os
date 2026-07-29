import { appApi } from "@/api/appClient";

export async function UploadFile({ file }) {
  return appApi.files.upload(file);
}

export async function ExtractDataFromUploadedFile(payload) {
  return appApi.integrations.extract(payload);
}

export async function InvokeLLM(payload) {
  return appApi.integrations.invokeLLM(payload);
}
