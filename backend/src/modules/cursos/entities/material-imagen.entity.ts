import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

//imagen dentro de una pagina; el archivo es solo de esa pagina
@Entity('materiales_imagenes')
export class MaterialImagen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @Column({ name: 'archivo_id', type: 'uuid' })
  archivoId: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn: Date;

  @Column({ name: 'creado_por', type: 'uuid' })
  creadoPor: string;
}
