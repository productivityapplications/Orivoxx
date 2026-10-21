"use client";

import { useEffect, useState } from "react";

import { db } from "../lib/db";

type Task = {
  id: string;
  title: string;
};

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let active = true;

    void db.listProjects().then((projects) => {
      if (!active) {
        return;
      }

      setTasks(
        projects.map((project) => ({
          id: `${project.id}-task-1`,
          title: `Review ${project.name}`,
        })),
      );
    });

    return () => {
      active = false;
    };
  }, []);

  if (tasks.length === 0) {
    return <p>No tasks yet.</p>;
  }

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}
