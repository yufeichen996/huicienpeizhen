export interface CatalogReview { id:string; targetType:'companion'|'service'|'hospital'; targetId:string; rating:number; tags:string[]; content:string; date:string; userName:string }
