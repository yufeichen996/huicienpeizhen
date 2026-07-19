Component({properties:{user:{type:Object,value:{}},loggedIn:{type:Boolean,value:false}},methods:{tap(){this.triggerEvent(this.properties.loggedIn?'edit':'login')}}})
