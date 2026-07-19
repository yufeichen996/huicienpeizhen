Component({
  properties: {
    companion: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      const companion = this.properties.companion as { id?: string } | null
      if (companion?.id) this.triggerEvent('select', { companionId: companion.id })
    },
  },
})
