Component({
  properties: {
    hospital: { type: Object, value: {} },
  },
  methods: {
    onTap() {
      const hospital = this.properties.hospital as { id?: string } | null
      if (hospital?.id) this.triggerEvent('select', { hospitalId: hospital.id })
    },
  },
})
