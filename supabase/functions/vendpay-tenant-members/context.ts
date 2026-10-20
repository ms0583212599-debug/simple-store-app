export type MemberContext={tenant:string,active:boolean,groups:Record<string,string>,authenticatedCheck:()=>Promise<{token:string,response:Response}>};
