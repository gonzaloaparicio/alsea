CREATE TABLE empleados(
    id_empleado BIGINT NOT NULL PRIMARY KEY,
    tipo VARCHAR(15) NOT NULL, -- ENTRENADOR|EMPLEADO
    dni INT NOT NULL,
    nombre VARCHAR(20) NOT NULL,
    apellido VARCHAR(20) NOT NULL,
    email VARCHAR(40) NOT NULL,
    nroSucursal INT NOT NULL
);


CREATE TABLE certificaciones(
    id_certificado BIGINT NOT NULL PRIMARY KEY,
    id_empleado BIGINT  NOT NULL, -- ENTRENADOR|EMPLEADO
    id_clase BIGINT  NOT NULL
);




CREATE TABLE cursos(
    id_curso BIGINT NOT NULL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200) NOT NULL
);


CREATE TABLE clases(
    id_clase BIGINT NOT NULL PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL,
    id_curso BIGINT NOT NULL
);


ALTER TABLE clases 
    ADD CONSTRAINT fk_clases_cursos FOREIGN KEY (id_curso) REFERENCES cursos(id_curso);


CREATE TABLE aulas(
    id_aula BIGINT NOT NULL PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL,
    direccion VARCHAR(50) NOT NULL,
    capacidad SMALLINT NOT NULL,
    tipo VARCHAR(20) NOT NULL -- SUCURSAL|AULA_CAPACITACION
);


CREATE TABLE planes_de_carrera(
    id_plan_de_carrera BIGINT NOT NULL PRIMARY KEY,
    id_curso BIGINT NOT NULL,
    id_clase BIGINT NOT NULL,
    id_empleado BIGINT NOT NULL,
    id_entrenador BIGINT NOT NULL,
    id_aula BIGINT NOT NULL,
    fecha DATE NOT NULL,
    nota VARCHAR(12), -- APROBADO|DESAPROBADO|NO_APLICA
    presente VARCHAR(9) -- SI|NO|NO_APLICA
);


ALTER TABLE planes_de_carrera 
    ADD CONSTRAINT fk_planes_curos FOREIGN KEY (id_curso) REFERENCES cursos(id_curso),
    ADD CONSTRAINT fk_planes_clases FOREIGN KEY (id_clase) REFERENCES clases(id_clase),
    ADD CONSTRAINT fk_planes_emp FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado),
    ADD CONSTRAINT fk_planes_emp2 FOREIGN KEY (id_entrenador) REFERENCES empleados(id_empleado),
    ADD CONSTRAINT fk_planes_aulas FOREIGN KEY (id_aula) REFERENCES aulas(id_aula),
    ADD CONSTRAINT unique_planes UNIQUE (id_plan_de_carrera,id_curso,id_clase,id_empleado,id_aula);